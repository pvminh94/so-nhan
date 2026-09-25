import Link from "next/link";
import { ArrowRight, CalendarDays, FileWarning, Users, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, requireMe, vnd } from "@/lib/api";

type Dashboard = {
  headcount: number;
  pendingLeave: number;
  runs: Array<{ id: string; label: string; status: string; company: string }>;
  departments: Array<{ id: string; name: string; count: number }>;
  expiring: Array<{ id: string; fullName: string; department: string; contractEnd: string }>;
  myPayslip: { runId: string; label: string; net: number | null } | null;
};

const runStatus: Record<string, { label: string; variant: "success" | "warning" | "danger" | "muted" }> = {
  LOCKED: { label: "Đã khóa", variant: "success" },
  CALCULATED: { label: "Đã tính", variant: "warning" },
  QUEUED: { label: "Chờ máy tính", variant: "warning" },
  CALCULATING: { label: "Đang tính", variant: "warning" },
  FAILED: { label: "Lỗi", variant: "danger" },
};

export default async function HomePage() {
  const me = await requireMe();
  const data = await api<Dashboard>("/api/dashboard");
  if (!data) return null;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const maxDept = Math.max(1, ...data.departments.map((d) => d.count));
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{greet}, {me.fullName}</p>
        <h1 className="mt-1">Bảng điều khiển</h1>
        <p className="sub">Công ty TNHH Sổ Nhân · tháng 9/2026. Số liệu demo để chạy một kỳ lương thật sự.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Users className="size-5" /></div>
            <div>
              <div className="k">Nhân sự đang làm</div>
              <div className="num">{data.headcount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-800"><CalendarDays className="size-5" /></div>
            <div>
              <div className="k">Đơn nghỉ chờ duyệt</div>
              <div className="num">{data.pendingLeave}</div>
              <div className="kpi-foot">{data.pendingLeave ? "Cần xử lý hôm nay" : "Không tồn đọng"}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-800"><Wallet className="size-5" /></div>
            <div>
              <div className="k">Kỳ lương hiện hành</div>
              <div className="mt-1 text-lg font-semibold">{data.runs[0]?.label ?? "—"}</div>
              <div className="kpi-foot">{data.runs[0]?.company ?? "Chưa có kỳ"}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-red-50 text-red-700"><FileWarning className="size-5" /></div>
            <div>
              <div className="k">HĐ hết hạn 60 ngày</div>
              <div className="num">{data.expiring.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Hồ sơ nhân viên", "Mã, hợp đồng, BHXH, người phụ thuộc", "/employees"],
          ["Bảng công 9/2026", "Nhập file, khóa công trước khi tính lương", "/attendance"],
          ["Tính lương", "Máy tính lương chạy riêng, không đơ màn hình", "/payroll"],
          ["Duyệt nghỉ phép", "Nhân viên gửi đơn, quản lý duyệt cấp dưới", "/leave"],
        ].map(([title, desc, href]) => (
          <Link key={href} href={href} className="group rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/30 hover:shadow">
            <div className="flex items-center justify-between">
              <b className="text-sm">{title}</b>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
          </Link>
        ))}
      </div>
      {data.myPayslip ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="k">Phiếu lương của tôi</div>
              <div className="mt-1 text-sm font-semibold">{data.myPayslip.label}</div>
              <p className="sub">Thực nhận <b className="money">{vnd(data.myPayslip.net)}</b></p>
            </div>
            <Link href={`/payroll/${data.myPayslip.runId}`} className="btn">Xem giải trình</Link>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardContent>
            <h2>Cơ cấu phòng ban</h2>
            {data.departments.map((item) => (
              <div key={item.id} className="mb-2.5">
                <div className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <b>{item.count}</b>
                </div>
                <div className="bar"><span style={{ width: `${Math.round((item.count / maxDept) * 100)}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h2>Kỳ lương gần đây</h2>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Kỳ</TableHead><TableHead>Pháp nhân</TableHead><TableHead>TT</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {data.runs.map((run) => {
                  const st = runStatus[run.status] ?? { label: run.status, variant: "muted" as const };
                  return (
                    <TableRow key={run.id}>
                      <TableCell><Link href={`/payroll/${run.id}`}>{run.label}</Link></TableCell>
                      <TableCell>{run.company}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent>
            <h2>Hợp đồng sắp hết hạn</h2>
            {data.expiring.length === 0 ? <p className="empty">Không có hợp đồng nào trong 60 ngày tới.</p> : null}
            {data.expiring.map((item) => (
              <div className="alert-row" key={item.id}>
                <div>
                  <Link href={`/employees/${item.id}`}>{item.fullName}</Link>
                  <div className="text-xs text-muted-foreground">{item.department}</div>
                </div>
                <Badge variant="warning">{new Date(item.contractEnd).toLocaleDateString("vi-VN")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
