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

export default async function AttendancePage() {
  await requireMe();
  const rows = await api<Row[]>("/api/attendance?month=2026-09");
  return (
    <>
      <div className="top">
        <div>
          <h1>Chấm công tháng 09/2026</h1>
          <p className="sub">Kỳ này là dữ liệu đã chốt để tính lương. Máy chấm công LAN sẽ đẩy log vào bảng này, không nối thẳng vào database.</p>
        </div>
      </div>
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
