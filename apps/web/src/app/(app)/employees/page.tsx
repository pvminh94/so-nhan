import Link from "next/link";
import { NewEmployeeForm } from "@/components/new-employee";
import { api, requireMe, vnd } from "@/lib/api";

type Employee = {
  id: string;
  code: string;
  fullName: string;
  jobTitle: string;
  department: string;
  status: string;
  baseSalary: number | null;
};

const statusLabel: Record<string, string> = { ACTIVE: "Đang làm", PROBATION: "Thử việc", TERMINATED: "Nghỉ việc" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireMe();
  const { q } = await searchParams;
  const rows = await api<Employee[]>(`/api/employees${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const departments = me.role === "ADMIN" || me.role === "HR" ? await api<Array<{ id: string; name: string }>>("/api/departments") : [];
  const canCreate = me.role === "ADMIN" || me.role === "HR";
  return (
    <>
      <div className="top">
        <div>
          <p className="hello">Hồ sơ · pháp nhân demo</p>
          <h1>Nhân sự</h1>
          <p className="sub">
            {me.role === "MANAGER"
              ? "Chỉ cấp dưới trực tiếp. Lương ẩn trừ phiếu của chính bạn."
              : me.role === "EMPLOYEE"
                ? "Chỉ hồ sơ của bạn."
                : `${rows?.length ?? 0} hồ sơ. Lương chỉ hiện với nhân sự, lương, quản trị, hoặc chính người đó.`}
          </p>
        </div>
        <form className="row" action="/employees">
          <input name="q" defaultValue={q} placeholder="Tên, mã, chức danh" style={{ width: 240 }} />
          <button className="btn">Tìm</button>
        </form>
      </div>
      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Mã</th><th>Họ tên</th><th>Chức danh</th><th>Phòng</th><th>Trạng thái</th><th>Lương hợp đồng</th></tr>
            </thead>
            <tbody>
              {rows?.map((row) => (
                <tr key={row.id}>
                  <td className="muted">{row.code}</td>
                  <td><Link href={`/employees/${row.id}`}>{row.fullName}</Link></td>
                  <td>{row.jobTitle}</td>
                  <td>{row.department}</td>
                  <td><span className={row.status === "TERMINATED" ? "tag no" : row.status === "PROBATION" ? "tag wait" : "tag ok"}>{statusLabel[row.status] ?? row.status}</span></td>
                  <td className="money">{vnd(row.baseSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows?.length ? <p className="empty">Không có hồ sơ khớp tìm kiếm.</p> : null}
      </article>
      {canCreate && departments ? (
        <article className="card" style={{ marginTop: 12 }}>
          <NewEmployeeForm departments={departments} />
        </article>
      ) : null}
    </>
  );
}
