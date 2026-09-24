import Link from "next/link";
import { api, requireMe } from "@/lib/api";

type Member = {
  id: string;
  code: string;
  fullName: string;
  jobTitle: string;
  department: string;
  status: string;
  pendingLeave: number;
};

export default async function TeamPage() {
  const me = await requireMe();
  if (me.role !== "MANAGER" && me.role !== "ADMIN" && me.role !== "HR") {
    return (
      <>
        <div className="top">
          <div>
            <h1>Nhóm</h1>
            <p className="sub">Trang này dành cho quản lý xem cấp dưới. Lương không hiện ở đây.</p>
          </div>
        </div>
      </>
    );
  }
  const rows = await api<Member[]>("/api/team");
  return (
    <>
      <div className="top">
        <div>
          <h1>Nhóm của tôi</h1>
          <p className="sub">Cấp dưới trực tiếp. Không hiện lương. Duyệt phép ở trang Nghỉ phép.</p>
        </div>
      </div>
      <article className="card">
        <table>
          <thead>
            <tr><th>Mã</th><th>Họ tên</th><th>Chức danh</th><th>Phòng</th><th>Đơn chờ</th></tr>
          </thead>
          <tbody>
            {rows?.map((row) => (
              <tr key={row.id}>
                <td>{row.code}</td>
                <td><Link href={`/employees/${row.id}`}>{row.fullName}</Link></td>
                <td>{row.jobTitle}</td>
                <td>{row.department}</td>
                <td>{row.pendingLeave}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows?.length ? <p className="muted">Chưa có cấp dưới.</p> : null}
      </article>
    </>
  );
}
