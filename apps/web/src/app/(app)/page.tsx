import Link from "next/link";
import { api, requireMe, vnd } from "@/lib/api";

type Dashboard = {
  headcount: number;
  pendingLeave: number;
  runs: Array<{ id: string; label: string; status: string; company: string }>;
  departments: Array<{ id: string; name: string; count: number }>;
  expiring: Array<{ id: string; fullName: string; department: string; contractEnd: string }>;
  myPayslip: { runId: string; label: string; net: number | null } | null;
};

export default async function HomePage() {
  await requireMe();
  const data = await api<Dashboard>("/api/dashboard");
  if (!data) return null;
  return (
    <>
      <div className="top">
        <div>
          <h1>Tổng quan</h1>
          <p className="sub">Một pháp nhân demo, đủ để thấy hồ sơ, phép, công và kỳ lương đi cùng nhau.</p>
        </div>
      </div>
      <div className="grid">
        <article className="card"><div className="k">Đang làm</div><div className="num">{data.headcount}</div></article>
        <article className="card"><div className="k">Phép chờ duyệt</div><div className="num">{data.pendingLeave}</div></article>
        <article className="card"><div className="k">Kỳ lương</div><div className="num">{data.runs[0]?.label ?? "—"}</div></article>
        <article className="card"><div className="k">Hợp đồng sắp hết</div><div className="num">{data.expiring.length}</div></article>
      </div>
      {data.myPayslip ? (
        <article className="card" style={{ marginTop: 12 }}>
          <h2>Phiếu lương của tôi · {data.myPayslip.label}</h2>
          <p>Thực nhận <b className="money">{vnd(data.myPayslip.net)}</b></p>
          <Link href={`/payroll/${data.myPayslip.runId}`}>Xem giải trình</Link>
        </article>
      ) : null}
      <div className="grid-2" style={{ marginTop: 12 }}>
        <article className="card">
          <h2>Phòng ban</h2>
          <table>
            <tbody>
              {data.departments.map((item) => (
                <tr key={item.id}><td>{item.name}</td><td>{item.count} người</td></tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="card">
          <h2>Kỳ lương gần đây</h2>
          {data.runs.map((run) => (
            <p key={run.id}><Link href={`/payroll/${run.id}`}>{run.label}</Link> · {run.company}</p>
          ))}
          <p className="muted">Tính lương đi qua worker, không chặn request.</p>
        </article>
        <article className="card">
          <h2>Hợp đồng hết hạn trong 60 ngày</h2>
          {data.expiring.length === 0 ? <p className="muted">Không có.</p> : null}
          {data.expiring.map((item) => (
            <p key={item.id}><Link href={`/employees/${item.id}`}>{item.fullName}</Link> · {item.department}</p>
          ))}
        </article>
      </div>
    </>
  );
}
