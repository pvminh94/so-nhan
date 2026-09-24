import Link from "next/link";
import { DependentsForm } from "@/components/dependents-form";
import { OffboardForm } from "@/components/offboard";
import { api, dateVN, requireMe, vnd } from "@/lib/api";

type Detail = {
  id: string;
  code: string;
  fullName: string;
  jobTitle: string;
  department: string;
  status: string;
  email: string | null;
  phone: string | null;
  hireDate: string;
  contractType: string;
  contractEnd: string | null;
  legalEntity: string;
  manager: { fullName: string } | null;
  baseSalary: number | null;
  insuranceSalary: number | null;
  dependents: number | null;
  bankName: string | null;
  bankAccount: string | null;
  citizenId: string | null;
  leaveBalances: Array<{ year: number; entitled: number; used: number }>;
  leaveLedger: Array<{ id: string; year: number; kind: string; days: number; note: string; at: string }>;
  dependentPeople: Array<{ id: string; fullName: string; relation: string; birthDate: string; warning: string | null }>;
};

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  const row = await api<Detail>(`/api/employees/${id}`);
  if (!row) return null;
  const balance = row.leaveBalances[0];
  return (
    <>
      <p className="muted"><Link href="/employees">Nhân sự</Link> / {row.code}</p>
      <div className="top">
        <div>
          <h1>{row.fullName}</h1>
          <p className="sub">{row.jobTitle} · {row.department} · {row.legalEntity}</p>
        </div>
      </div>
      <div className="grid-2">
        <article className="card">
          <h2>Hồ sơ</h2>
          <table>
            <tbody>
              <tr><td>Email</td><td>{row.email ?? "—"}</td></tr>
              <tr><td>Điện thoại</td><td>{row.phone ?? "—"}</td></tr>
              <tr><td>Ngày vào</td><td>{dateVN(row.hireDate)}</td></tr>
              <tr><td>Hợp đồng</td><td>{row.contractType}{row.contractEnd ? ` đến ${dateVN(row.contractEnd)}` : ""}</td></tr>
              <tr><td>Quản lý</td><td>{row.manager?.fullName ?? "—"}</td></tr>
              <tr><td>CCCD</td><td>{row.citizenId ?? "ẩn"}</td></tr>
              <tr><td>Ngân hàng</td><td>{row.bankName ? `${row.bankName} ${row.bankAccount}` : "ẩn"}</td></tr>
            </tbody>
          </table>
        </article>
        <article className="card">
          <h2>Đãi ngộ và phép</h2>
          <p>Lương hợp đồng: <b className="money">{vnd(row.baseSalary)}</b></p>
          <p>Lương đóng BHXH: <b className="money">{vnd(row.insuranceSalary)}</b></p>
          <p>Người phụ thuộc: {row.dependents ?? "ẩn"}</p>
          {row.dependents != null && (me.employeeId === row.id || me.role === "ADMIN" || me.role === "HR" || me.role === "PAYROLL") ? (
            <DependentsForm employeeId={row.id} count={row.dependents} people={row.dependentPeople ?? []} />
          ) : null}
          {balance ? <p>Phép {balance.year}: {balance.entitled - balance.used} ngày còn lại / {balance.entitled} ngày</p> : null}
          {(me.role === "ADMIN" || me.role === "HR") && row.status !== "TERMINATED" ? <OffboardForm id={row.id} /> : null}
        </article>
      </div>
    </>
  );
}
