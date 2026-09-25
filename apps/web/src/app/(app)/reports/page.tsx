import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, requireMe, vnd } from "@/lib/api";
import Link from "next/link";

type Report = {
  asOf: string;
  headcount: number;
  pendingLeave: number;
  expiring: number;
  fund: number | null;
  byDepartment: Array<{ name: string; count: number }>;
  byStatus: Array<{ name: string; count: number }>;
  byContract: Array<{ name: string; count: number }>;
  lastPayroll: {
    id: string;
    label: string;
    company: string;
    status: string;
    net: number;
    gross: number;
    pit: number;
    insurance: number;
  } | null;
};

const statusLabel: Record<string, string> = { ACTIVE: "Đang làm", PROBATION: "Thử việc", TERMINATED: "Nghỉ việc" };
const contractLabel: Record<string, string> = {
  DEFINITE: "Xác định thời hạn",
  INDEFINITE: "Không xác định thời hạn",
  PROBATION: "Thử việc",
};

export default async function ReportsPage() {
  await requireMe();
  const data = await api<Report>("/api/reports");
  if (!data) {
    return (
      <>
        <h1>Báo cáo</h1>
        <p className="sub">Bạn không có quyền xem báo cáo này.</p>
      </>
    );
  }
  const max = Math.max(1, ...data.byDepartment.map((item) => item.count));
  return (
    <div className="space-y-5">
      <div>
        <p className="hello">Quản trị nhân sự</p>
        <h1>Báo cáo nhân sự</h1>
        <p className="sub">Số liệu tại thời điểm xem. Không phải kho phân tích tách riêng — đủ để họp đầu tuần.</p>
      </div>
      <div className="grid">
        <article className="card"><div className="k">Đang làm</div><div className="num">{data.headcount}</div></article>
        <article className="card"><div className="k">Đơn nghỉ chờ</div><div className="num">{data.pendingLeave}</div></article>
        <article className="card"><div className="k">HĐ hết hạn 60 ngày</div><div className="num">{data.expiring}</div></article>
        <article className="card"><div className="k">Quỹ lương hợp đồng / tháng</div><div className="num" style={{ fontSize: 22 }}>{vnd(data.fund)}</div></article>
      </div>
      {data.lastPayroll ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="k">Kỳ lương gần nhất</div>
              <div className="mt-1 font-semibold">{data.lastPayroll.label} · {data.lastPayroll.company}</div>
              <p className="sub">
                Gross {vnd(data.lastPayroll.gross)} · BHXH {vnd(data.lastPayroll.insurance)} · TNCN {vnd(data.lastPayroll.pit)} · thực nhận {vnd(data.lastPayroll.net)}
              </p>
            </div>
            <Link href={`/payroll/${data.lastPayroll.id}`} className="btn">Mở kỳ lương</Link>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid-2">
        <article className="card">
          <h2>Theo phòng ban</h2>
          {data.byDepartment.map((item) => (
            <div key={item.name} className="mb-2.5">
              <div className="flex justify-between text-sm"><span>{item.name}</span><b>{item.count}</b></div>
              <div className="bar"><span style={{ width: `${Math.round((item.count / max) * 100)}%` }} /></div>
            </div>
          ))}
        </article>
        <article className="card">
          <h2>Theo trạng thái và hợp đồng</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {data.byStatus.map((item) => (
              <Badge key={item.name} variant={item.name === "PROBATION" ? "warning" : "success"}>
                {statusLabel[item.name] ?? item.name}: {item.count}
              </Badge>
            ))}
          </div>
          <table>
            <tbody>
              {data.byContract.map((item) => (
                <tr key={item.name}>
                  <td>{contractLabel[item.name] ?? item.name}</td>
                  <td className="text-right font-medium">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </div>
  );
}
