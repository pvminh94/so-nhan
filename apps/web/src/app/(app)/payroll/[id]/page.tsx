import Link from "next/link";
import { PayrollActions } from "@/components/payroll-actions";
import { QueueRefresh } from "@/components/queue-refresh";
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
  error?: string | null;
  company: string;
  ruleVersion: string;
  totals: { gross: number; net: number; pit: number; insuranceEmployee: number; insuranceEmployer: number };
  payslips: Slip[];
};
type Variance = {
  previous: { id: string; year: number; month: number } | null;
  unexplained: number;
  changed: number;
  delta: number;
  rows: Array<{ code: string; fullName: string; previousNet: number; currentNet: number; delta: number; reasons: string[]; unexplained: boolean }>;
};

export default async function PayrollDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  const run = await api<Run>(`/api/payroll/runs/${id}`);
  if (!run) return null;
  const canRun = me.role === "ADMIN" || me.role === "PAYROLL";
  const canCompare = me.role === "ADMIN" || me.role === "HR" || me.role === "PAYROLL";
  const variance = canCompare && (run.status === "CALCULATED" || run.status === "LOCKED")
    ? await api<Variance>(`/api/payroll/runs/${id}/variance`)
    : null;
  const bank = canRun && (run.status === "CALCULATED" || run.status === "LOCKED")
    ? await api<{ total: number; expectedNet: number; rows: number; sha256: string; missingAccounts: string[] }>(`/api/payroll/runs/${id}/bank`)
    : null;
  return (
    <>
      <p className="muted"><Link href="/payroll">Lương</Link> / {String(run.month).padStart(2, "0")}/{run.year}</p>
      <div className="top">
        <div>
          <h1>{run.company}</h1>
          <p className="sub">Luật {run.ruleVersion}. Trạng thái {run.status}.{run.error ? ` ${run.error}` : ""}</p>
          <QueueRefresh status={run.status} />
        </div>
        <PayrollActions canRun={canRun} runId={run.id} status={run.status} />
      </div>
      <div className="grid">
        <article className="card"><div className="k">Tổng gross</div><div className="num" style={{ fontSize: 22 }}>{vnd(run.totals.gross)}</div></article>
        <article className="card"><div className="k">BHXH NLĐ</div><div className="num" style={{ fontSize: 22 }}>{vnd(run.totals.insuranceEmployee)}</div></article>
        <article className="card"><div className="k">TNCN</div><div className="num" style={{ fontSize: 22 }}>{vnd(run.totals.pit)}</div></article>
        <article className="card"><div className="k">Thực nhận</div><div className="num" style={{ fontSize: 22 }}>{vnd(run.totals.net)}</div></article>
      </div>
      {bank ? (
        <article className="card" style={{ marginTop: 12 }}>
          <h2>Đối soát file ngân hàng</h2>
          <p>Tổng file {vnd(bank.total)} · tổng thực nhận {vnd(bank.expectedNet)} · {bank.rows} dòng.</p>
          <p className={bank.total === bank.expectedNet && !bank.missingAccounts.length ? "ok" : "warn"}>
            {bank.total === bank.expectedNet && !bank.missingAccounts.length
              ? `Khớp. SHA-256 ${bank.sha256.slice(0, 12)}…`
              : bank.missingAccounts.length
                ? `Thiếu tài khoản: ${bank.missingAccounts.join(", ")}`
                : "Tổng file lệch tổng thực nhận. Không chuyển khoản."}
          </p>
        </article>
      ) : null}
      {variance ? (
        <article className="card" style={{ marginTop: 12 }}>
          <h2>Đối chiếu kỳ trước</h2>
          {!variance.previous ? <p className="muted">Chưa có kỳ liền trước đã tính. Cổng khóa sổ cần hai kỳ và không còn dòng chưa giải thích.</p> : null}
          {variance.previous ? (
            <>
              <p>So với {String(variance.previous.month).padStart(2, "0")}/{variance.previous.year}: {variance.changed} người đổi thực nhận, chênh {vnd(variance.delta)}.</p>
              <p className={variance.unexplained ? "warn" : "ok"}>{variance.unexplained ? `${variance.unexplained} dòng chưa giải thích` : "Không còn biến động chưa giải thích"}</p>
              {variance.rows.length ? (
                <table>
                  <thead><tr><th>Người</th><th>Kỳ trước</th><th>Kỳ này</th><th>Lý do</th></tr></thead>
                  <tbody>
                    {variance.rows.map((row) => (
                      <tr key={row.code}>
                        <td>{row.fullName}</td>
                        <td className="money">{vnd(row.previousNet)}</td>
                        <td className="money">{vnd(row.currentNet)}</td>
                        <td>{row.reasons.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </>
          ) : null}
        </article>
      ) : null}
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
            {slip.lines.some((line) => line.code.startsWith("BHXH_")) ? (
              <>
                <h2 style={{ marginTop: 14 }}>Do quỹ BHXH chi — không lấy từ lương công ty</h2>
                <table>
                  <tbody>
                    {slip.lines.filter((line) => line.code.startsWith("BHXH_")).map((line) => (
                      <tr key={line.id}>
                        <td>{line.name}<div className="formula">{line.formula}</div></td>
                        <td className="money">{vnd(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
