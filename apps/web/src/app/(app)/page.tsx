import Link from "next/link";
import { api, requireMe } from "@/lib/api";

type Dashboard = {
  headcount: number;
  pendingLeave: number;
  runs: Array<{ id: string; label: string; status: string; company: string }>;
  departments: Array<{ id: string; name: string; count: number }>;
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
        <article className="card"><div className="k">Trạng thái</div><div className="num" style={{ fontSize: 22 }}>{data.runs[0]?.status === "LOCKED" ? "Đã khóa" : "Đã tính"}</div></article>
      </div>
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
          <p className="muted">Kiến trúc chạy 3 tiến trình. Bản demo gộp trên một máy để xem được ngay.</p>
        </article>
      </div>
    </>
  );
}
