import Link from "next/link";
import { PayrollActions } from "@/components/payroll-actions";
import { api, requireMe, vnd } from "@/lib/api";

type Line = { id: string; code: string; name: string; amount: number; formula: string; pitTreatment: string };
type Slip = {
  id: string;
  code: string;
  fullName: string;
  gross: number;
  pit: number;
  net: number;
  insuranceEmployee: number;
  warnings: string[];
  lines: Line[];
};
type Run = {
  id: string;
  year: number;
  month: number;
  status: string;
  company: string;
  ruleVersion: string;
  totals: { gross: number; net: number; pit: number; insuranceEmployee: number; insuranceEmployer: number };
  payslips: Slip[];
};

export default async function PayrollDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  const run = await api<Run>(`/api/payroll/runs/${id}`);
  if (!run) return null;
  const canRun = me.role === "ADMIN" || me.role === "PAYROLL";
  return (
    <>
      <p className="muted"><Link href="/payroll">Lương</Link> / {String(run.month).padStart(2, "0")}/{run.year}</p>
      <div className="top">
        <div>
          <h1>{run.company}</h1>
          <p className="sub">Luật {run.ruleVersion}. {run.status === "LOCKED" ? "Kỳ đã khóa." : "Kỳ chưa khóa."}</p>
        </div>
        <PayrollActions canRun={canRun} runId={run.id} locked={run.status === "LOCKED"} />
      </div>
      <div className="grid">
        <article className="card"><div className="k">Tổng gross</div><div className="num" style={{ fontSize: 22 }}>{vnd(run.totals.gross)}</div></article>
        <article className="card"><div className="k">BHXH NLĐ</div><div className="num" style={{ fontSize: 22 }}>{vnd(run.totals.insuranceEmployee)}</div></article>
        <article className="card"><div className="k">TNCN</div><div className="num" style={{ fontSize: 22 }}>{vnd(run.totals.pit)}</div></article>
        <article className="card"><div className="k">Thực nhận</div><div className="num" style={{ fontSize: 22 }}>{vnd(run.totals.net)}</div></article>
      </div>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {run.payslips.map((slip) => (
          <article className="card" key={slip.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>{slip.fullName} · {slip.code}</h2>
              <b className="money">{vnd(slip.net)}</b>
            </div>
            {slip.warnings.map((warning) => <p className="warn" key={warning}>{warning}</p>)}
            <table>
              <tbody>
                {slip.lines.filter((line) => line.pitTreatment !== "info").map((line) => (
                  <tr key={line.id}>
                    <td>{line.name}<div className="formula">{line.formula}</div></td>
                    <td className="money">{line.pitTreatment === "deduction" ? "−" : ""}{vnd(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </div>
    </>
  );
}
