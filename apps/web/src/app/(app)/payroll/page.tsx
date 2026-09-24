import Link from "next/link";
import { PayrollActions } from "@/components/payroll-actions";
import { api, requireMe } from "@/lib/api";

type Run = { id: string; year: number; month: number; status: string; company: string; payslips: number; ruleVersion: string };

export default async function PayrollPage() {
  const me = await requireMe();
  const runs = await api<Run[]>("/api/payroll/runs");
  const canRun = me.role === "ADMIN" || me.role === "PAYROLL";
  return (
    <>
      <div className="top">
        <div>
          <h1>Lương</h1>
          <p className="sub">Engine thuần tính BHXH và TNCN. Kỳ đã khóa không tính đè.</p>
        </div>
        <PayrollActions canRun={canRun} />
      </div>
      <article className="card">
        <table>
          <thead><tr><th>Kỳ</th><th>Pháp nhân</th><th>Phiếu</th><th>Luật</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {runs?.map((run) => (
              <tr key={run.id}>
                <td><Link href={`/payroll/${run.id}`}>{String(run.month).padStart(2, "0")}/{run.year}</Link></td>
                <td>{run.company}</td>
                <td>{run.payslips}</td>
                <td>{run.ruleVersion}</td>
                <td><span className={run.status === "LOCKED" ? "tag ok" : "tag wait"}>{run.status === "LOCKED" ? "Đã khóa" : "Đã tính"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </>
  );
}
