import { api, dateVN, requireMe } from "@/lib/api";

type Event = { id: string; at: string; action: string; entity: string; entityId: string | null; actor: string };

const actionLabel: Record<string, string> = {
  LOGIN: "Đăng nhập",
  LOGIN_FAILED: "Đăng nhập sai",
  CREATE_EMPLOYEE: "Tạo hồ sơ",
  REQUEST_LEAVE: "Xin phép",
  LEAVE_APPROVED: "Duyệt phép",
  LEAVE_REJECTED: "Từ chối phép",
  QUEUE_PAYROLL: "Đưa kỳ lương vào hàng đợi",
  CALCULATE_PAYROLL: "Tính lương",
  LOCK_PAYROLL: "Khóa kỳ lương",
  EXPORT_BANK: "Xuất file ngân hàng",
  EXPORT_JOURNAL: "Xuất bút toán",
  VIEW_PAYSLIP: "Xem phiếu lương",
  IMPORT_ATTENDANCE: "Nhập công",
  OFFBOARD: "Nghỉ việc",
};

export default async function AuditPage() {
  const me = await requireMe();
  if (me.role !== "ADMIN" && me.role !== "HR" && me.role !== "AUDITOR") {
    return <h1>Nhật ký chỉ mở cho nhân sự, quản trị và kiểm toán.</h1>;
  }
  const rows = await api<Event[]>("/api/audit");
  return (
    <>
      <div className="top">
        <div>
          <h1>Nhật ký</h1>
          <p className="sub">Ai xem lương, khóa kỳ, xuất file. Không sửa được dòng đã ghi.</p>
        </div>
      </div>
      <article className="card">
        <table>
          <thead><tr><th>Lúc</th><th>Ai</th><th>Việc</th><th>Đối tượng</th></tr></thead>
          <tbody>
            {rows?.map((row) => (
              <tr key={row.id}>
                <td>{dateVN(row.at)}</td>
                <td>{row.actor}</td>
                <td>{actionLabel[row.action] ?? row.action}</td>
                <td>{row.entity} {row.entityId ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </>
  );
}
