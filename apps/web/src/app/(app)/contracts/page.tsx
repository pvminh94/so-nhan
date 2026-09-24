import Link from "next/link";
import { api, dateVN, requireMe } from "@/lib/api";

type Contract = {
  id: string;
  code: string;
  fullName: string;
  department: string;
  contractType: string;
  contractStart: string;
  contractEnd: string | null;
  daysLeft: number | null;
};

const typeLabel: Record<string, string> = {
  DEFINITE: "Xác định thời hạn",
  INDEFINITE: "Không xác định thời hạn",
  PROBATION: "Thử việc",
};

export default async function ContractsPage() {
  await requireMe();
  const rows = await api<Contract[]>("/api/contracts");
  return (
    <>
      <div className="top">
        <div>
          <h1>Hợp đồng</h1>
          <p className="sub">Hết hạn trong 60 ngày được tô đậm. Không xác định thời hạn không có ngày kết thúc.</p>
        </div>
      </div>
      <article className="card">
        <table>
          <thead><tr><th>Mã</th><th>Họ tên</th><th>Phòng</th><th>Loại</th><th>Bắt đầu</th><th>Kết thúc</th><th>Còn</th></tr></thead>
          <tbody>
            {rows?.map((row) => (
              <tr key={row.id}>
                <td>{row.code}</td>
                <td><Link href={`/employees/${row.id}`}>{row.fullName}</Link></td>
                <td>{row.department}</td>
                <td>{typeLabel[row.contractType] ?? row.contractType}</td>
                <td>{dateVN(row.contractStart)}</td>
                <td>{row.contractEnd ? dateVN(row.contractEnd) : "—"}</td>
                <td className={row.daysLeft != null && row.daysLeft <= 60 ? "warn" : ""}>{row.daysLeft ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </>
  );
}
