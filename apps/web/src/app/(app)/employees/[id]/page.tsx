import Link from "next/link";
import { AllowanceForm } from "@/components/allowance-form";
import { DependentsForm } from "@/components/dependents-form";
import { OffboardForm } from "@/components/offboard";
import { TransferForm } from "@/components/transfer-form";
import { Badge } from "@/components/ui/badge";
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
  allowances: Array<{ id: string; code: string; name: string; amount: number; taxable: boolean }>;
  orgMoves: Array<{
    id: string;
    fromDepartment: string;
    toDepartment: string;
    fromTitle: string;
    toTitle: string;
    reason: string;
    effectiveDate: string;
  }>;
};

const statusLabel: Record<string, string> = { ACTIVE: "Đang làm", PROBATION: "Thử việc", TERMINATED: "Nghỉ việc" };
const contractLabel: Record<string, string> = {
  DEFINITE: "Xác định thời hạn",
  INDEFINITE: "Không xác định thời hạn",
  PROBATION: "Thử việc",
};

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  const row = await api<Detail>(`/api/employees/${id}`);
  const departments = me.role === "ADMIN" || me.role === "HR" ? await api<Array<{ id: string; name: string }>>("/api/departments") : [];
  if (!row) return null;
  const balance = row.leaveBalances[0];
  const canPay = me.role === "ADMIN" || me.role === "HR" || me.role === "PAYROLL";
  return (
    <>
      <p className="mb-2 text-sm text-muted-foreground"><Link href="/employees">Nhân sự</Link> / {row.code}</p>
      <div className="top">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1>{row.fullName}</h1>
            <Badge variant={row.status === "PROBATION" ? "warning" : row.status === "TERMINATED" ? "danger" : "success"}>
              {statusLabel[row.status] ?? row.status}
            </Badge>
          </div>
          <p className="sub">{row.jobTitle} · {row.department} · {row.legalEntity}</p>
        </div>
      </div>
      <div className="grid-2">
        <article className="card">
          <h2>Hồ sơ</h2>
          <table>
            <tbody>
              <tr><td className="muted">Email</td><td>{row.email ?? "—"}</td></tr>
              <tr><td className="muted">Điện thoại</td><td>{row.phone ?? "—"}</td></tr>
              <tr><td className="muted">Ngày vào</td><td>{dateVN(row.hireDate)}</td></tr>
              <tr><td className="muted">Hợp đồng</td><td>{contractLabel[row.contractType] ?? row.contractType}{row.contractEnd ? ` · đến ${dateVN(row.contractEnd)}` : ""}</td></tr>
              <tr><td className="muted">Quản lý</td><td>{row.manager?.fullName ?? "—"}</td></tr>
              <tr><td className="muted">CCCD</td><td>{row.citizenId ?? "ẩn"}</td></tr>
              <tr><td className="muted">Ngân hàng</td><td>{row.bankName ? `${row.bankName} ${row.bankAccount}` : "ẩn"}</td></tr>
            </tbody>
          </table>
          {canPay && departments ? <TransferForm employeeId={row.id} departments={departments} /> : null}
          {row.orgMoves?.length ? (
            <div className="mt-4">
              <h2>Lịch sử điều chuyển</h2>
              <table>
                <tbody>
                  {row.orgMoves.map((item) => (
                    <tr key={item.id}>
                      <td>{dateVN(item.effectiveDate)}</td>
                      <td>{item.fromDepartment} → {item.toDepartment}</td>
                      <td className="muted">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>
        <article className="card">
          <h2>Đãi ngộ và phép</h2>
          <p>Lương hợp đồng: <b className="money">{vnd(row.baseSalary)}</b></p>
          <p>Lương đóng BHXH: <b className="money">{vnd(row.insuranceSalary)}</b></p>
          <p>Người phụ thuộc: {row.dependents ?? "ẩn"}</p>
          {row.dependents != null && (me.employeeId === row.id || canPay) ? (
            <DependentsForm employeeId={row.id} count={row.dependents} people={row.dependentPeople ?? []} />
          ) : null}
          {balance ? <p>Phép {balance.year}: còn {balance.entitled - balance.used} / {balance.entitled} ngày</p> : null}
          {canPay ? <AllowanceForm employeeId={row.id} items={row.allowances ?? []} /> : (
            row.allowances?.length ? (
              <table className="mt-3">
                <tbody>
                  {row.allowances.map((item) => (
                    <tr key={item.id}><td>{item.name}</td><td className="money">{vnd(item.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : null
          )}
          {(me.role === "ADMIN" || me.role === "HR") && row.status !== "TERMINATED" ? <OffboardForm id={row.id} /> : null}
        </article>
      </div>
    </>
  );
}
