import { AttendanceImport } from "@/components/attendance-import";
import { AttendanceLock } from "@/components/attendance-lock";
import { api, requireMe } from "@/lib/api";

type Row = {
  id: string;
  code: string;
  fullName: string;
  department: string;
  standardDays: number;
  workedDays: number;
  unpaidDays: number;
  otWeekdayHours: number;
  nightHours: number;
  locked: boolean;
};
type Period = {
  periodLocked: boolean;
  missing: string[];
  open: string[];
  payrollLocked: boolean;
  canLock: boolean;
  canUnlock: boolean;
};

export default async function AttendancePage() {
  const me = await requireMe();
  const rows = await api<Row[]>("/api/attendance?month=2026-09");
  const period = await api<Period>("/api/attendance/period?month=2026-09");
  const canImport = (me.role === "ADMIN" || me.role === "HR" || me.role === "PAYROLL") && !period?.periodLocked;
  return (
    <>
      <div className="top">
        <div>
          <h1>Bảng công tháng 9/2026</h1>
          <p className="sub">Nhập file khi kỳ còn mở. Khóa bảng công xong mới tính lương được.</p>
        </div>
      </div>
      {period ? <AttendanceLock period={period} canManage={me.role === "ADMIN" || me.role === "HR" || me.role === "PAYROLL"} /> : null}
      <AttendanceImport canImport={canImport} />
      <article className="card">
        <table>
          <thead>
            <tr><th>Mã</th><th>Họ tên</th><th>Phòng</th><th>Công</th><th>Không lương</th><th>OT ngày thường</th><th>Đêm</th><th>Khóa</th></tr>
          </thead>
          <tbody>
            {rows?.map((row) => (
              <tr key={row.id}>
                <td>{row.code}</td>
                <td>{row.fullName}</td>
                <td>{row.department}</td>
                <td>{row.workedDays}/{row.standardDays}</td>
                <td>{row.unpaidDays}</td>
                <td>{row.otWeekdayHours}</td>
                <td>{row.nightHours}</td>
                <td>{row.locked ? "Đã khóa" : "Mở"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </>
  );
}
