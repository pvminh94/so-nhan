import { DecideButtons, LeaveRequestForm } from "@/components/leave-actions";
import { api, dateVN, requireMe } from "@/lib/api";

type LeaveRow = {
  id: string;
  typeLabel: string;
  payer: string;
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
          <p className="hello">Xin nghỉ · duyệt nghỉ</p>
          <h1>Nghỉ phép và vắng mặt</h1>
          <p className="sub">
            Phép năm công ty trả lương. Ốm đau và thai sản do quỹ BHXH chi, không lấy từ quỹ lương.
            Nghỉ không lương từ 14 ngày trong tháng thì không đóng bảo hiểm tháng đó.
          </p>
        </div>
      </div>
      <article className="card" style={{ marginBottom: 12 }}>
        <LeaveRequestForm enabled={Boolean(me.employeeId)} />
        {!me.employeeId ? <p className="muted">Tài khoản này chưa gắn hồ sơ nhân viên nên không gửi đơn được.</p> : null}
      </article>
      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Người</th><th>Loại</th><th>Ai trả</th><th>Ngày</th><th>Số ngày</th><th>Lý do</th><th>Trạng thái</th><th></th></tr>
            </thead>
            <tbody>
              {rows?.map((row) => (
                <tr key={row.id}>
                  <td>{row.employee.fullName}<div className="muted">{row.employee.department}</div></td>
                  <td>{row.typeLabel}</td>
                  <td>{row.payer}</td>
                  <td>{dateVN(row.startDate)} – {dateVN(row.endDate)}</td>
                  <td>{row.days}</td>
                  <td>{row.reason}</td>
                  <td><span className={klass[row.status]}>{label[row.status]}</span></td>
                  <td>{canDecide && row.status === "PENDING" ? <DecideButtons id={row.id} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows?.length ? <p className="empty">Chưa có đơn nghỉ.</p> : null}
      </article>
    </>
  );
}
