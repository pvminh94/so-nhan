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

const runStatus: Record<string, [string, string]> = {
  LOCKED: ["Đã khóa", "ok"],
  CALCULATED: ["Đã tính", "wait"],
  QUEUED: ["Chờ worker", "wait"],
  CALCULATING: ["Đang tính", "wait"],
  FAILED: ["Lỗi", "no"],
};

export default async function HomePage() {
  const me = await requireMe();
  const data = await api<Dashboard>("/api/dashboard");
  if (!data) return null;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const maxDept = Math.max(1, ...data.departments.map((d) => d.count));
  return (
    <>
      <div className="top">
        <div>
          <p className="hello">{greet}, {me.fullName}</p>
          <h1>Bảng điều khiển</h1>
          <p className="sub">Công ty TNHH Sổ Nhân · tháng 9/2026. Số liệu demo để chạy một kỳ lương thật sự.</p>
        </div>
      </div>
      <div className="grid">
        <article className="card kpi">
          <div className="kpi-ico green">👤</div>
          <div>
            <div className="k">Nhân sự đang làm</div>
            <div className="num">{data.headcount}</div>
            <div className="kpi-foot">Toàn pháp nhân</div>
          </div>
        </article>
        <article className="card kpi">
          <div className="kpi-ico amber">✉</div>
          <div>
            <div className="k">Phép chờ duyệt</div>
            <div className="num">{data.pendingLeave}</div>
            <div className="kpi-foot">{data.pendingLeave ? "Cần xử lý hôm nay" : "Không tồn đọng"}</div>
          </div>
        </article>
        <article className="card kpi">
          <div className="kpi-ico blue">₫</div>
          <div>
            <div className="k">Kỳ lương hiện hành</div>
            <div className="num" style={{ fontSize: 20 }}>{data.runs[0]?.label ?? "—"}</div>
            <div className="kpi-foot">{data.runs[0]?.company ?? "Chưa có kỳ"}</div>
          </div>
        </article>
        <article className="card kpi">
          <div className="kpi-ico red">⚠</div>
          <div>
            <div className="k">HĐ hết hạn 60 ngày</div>
            <div className="num">{data.expiring.length}</div>
            <div className="kpi-foot">Nhắc gia hạn / nghỉ việc</div>
          </div>
        </article>
      </div>
      <div className="quick">
        <Link href="/employees"><b>Hồ sơ nhân viên</b><span>Mã, hợp đồng, BHXH, người phụ thuộc</span></Link>
        <Link href="/attendance"><b>Chấm công 09/2026</b><span>Nhập file, khóa công trước khi tính lương</span></Link>
        <Link href="/payroll"><b>Tính lương</b><span>Worker riêng, không chặn giao diện</span></Link>
        <Link href="/leave"><b>Duyệt nghỉ phép</b><span>ESS gửi đơn · MSS duyệt cấp dưới</span></Link>
      </div>
      {data.myPayslip ? (
        <article className="card" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div className="k">Phiếu lương của tôi</div>
            <h2 style={{ margin: "4px 0 0" }}>{data.myPayslip.label}</h2>
            <p className="sub">Thực nhận <b className="money">{vnd(data.myPayslip.net)}</b></p>
          </div>
          <Link className="btn" href={`/payroll/${data.myPayslip.runId}`}>Xem giải trình</Link>
        </article>
      ) : null}
      <div className="grid-2">
        <article className="card">
          <h2>Cơ cấu phòng ban</h2>
          {data.departments.map((item) => (
            <div key={item.id} style={{ marginBottom: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>{item.name}</span>
                <b>{item.count}</b>
              </div>
              <div className="bar"><span style={{ width: `${Math.round((item.count / maxDept) * 100)}%` }} /></div>
            </div>
          ))}
        </article>
        <article className="card">
          <h2>Kỳ lương gần đây</h2>
          <table>
            <thead><tr><th>Kỳ</th><th>Pháp nhân</th><th>TT</th></tr></thead>
            <tbody>
              {data.runs.map((run) => {
                const [label, klass] = runStatus[run.status] ?? [run.status, "wait"];
                return (
                  <tr key={run.id}>
                    <td><Link href={`/payroll/${run.id}`}>{run.label}</Link></td>
                    <td>{run.company}</td>
                    <td><span className={`tag ${klass}`}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>
        <article className="card">
          <h2>Hợp đồng sắp hết hạn</h2>
          {data.expiring.length === 0 ? <p className="empty">Không có hợp đồng nào trong 60 ngày tới.</p> : null}
          {data.expiring.map((item) => (
            <div className="alert-row" key={item.id}>
              <div>
                <Link href={`/employees/${item.id}`}>{item.fullName}</Link>
                <div className="muted" style={{ fontSize: 12 }}>{item.department}</div>
              </div>
              <span className="tag wait">{new Date(item.contractEnd).toLocaleDateString("vi-VN")}</span>
            </div>
          ))}
        </article>
      </div>
    </>
  );
}
