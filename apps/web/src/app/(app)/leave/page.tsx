import { DecideButtons, LeaveRequestForm } from "@/components/leave-actions";
import { api, dateVN, requireMe } from "@/lib/api";

type LeaveRow = {
  id: string;
  typeLabel: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  employee: { fullName: string; code: string; department: string };
};

const label = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối" };
const klass = { PENDING: "tag wait", APPROVED: "tag ok", REJECTED: "tag no" };

export default async function LeavePage() {
  const me = await requireMe();
  const rows = await api<LeaveRow[]>("/api/leave");
  const canDecide = me.role === "ADMIN" || me.role === "HR" || me.role === "MANAGER";
  return (
    <>
      <div className="top">
        <div>
          <h1>Nghỉ phép</h1>
          <p className="sub">Nhân viên thấy đơn của mình. Quản lý thấy cấp dưới. Nhân sự thấy toàn bộ.</p>
        </div>
      </div>
      <article className="card" style={{ marginBottom: 12 }}>
        <LeaveRequestForm enabled={Boolean(me.employeeId)} />
        {!me.employeeId ? <p className="muted">Tài khoản quản trị không gắn hồ sơ nên không gửi đơn.</p> : null}
      </article>
      <article className="card">
        <table>
          <thead>
            <tr><th>Người</th><th>Loại</th><th>Ngày</th><th>Số ngày</th><th>Lý do</th><th>Trạng thái</th><th></th></tr>
          </thead>
          <tbody>
            {rows?.map((row) => (
              <tr key={row.id}>
                <td>{row.employee.fullName}<div className="muted">{row.employee.department}</div></td>
                <td>{row.typeLabel}</td>
                <td>{dateVN(row.startDate)} – {dateVN(row.endDate)}</td>
                <td>{row.days}</td>
                <td>{row.reason}</td>
                <td><span className={klass[row.status]}>{label[row.status]}</span></td>
                <td>{canDecide && row.status === "PENDING" ? <DecideButtons id={row.id} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </>
  );
}
