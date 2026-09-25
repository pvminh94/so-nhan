import Link from "next/link";
import {
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Scale,
  Search,
  Settings2,
  Users,
  Wallet,
} from "lucide-react";
import { roleLabel, type Me } from "@/lib/api";
import { initials } from "@/lib/utils";
import { LogoutButton } from "./logout";

type Item = { href: string; label: string; icon: typeof LayoutDashboard; group: string };

function linksFor(role: Me["role"]): Item[] {
  if (role === "EMPLOYEE") {
    return [
      { href: "/", label: "Tổng quan", icon: LayoutDashboard, group: "Chung" },
      { href: "/employees", label: "Hồ sơ của tôi", icon: Users, group: "Nhân sự" },
      { href: "/leave", label: "Nghỉ phép", icon: CalendarDays, group: "Thời gian" },
      { href: "/payroll", label: "Phiếu lương", icon: Wallet, group: "Lương" },
      { href: "/notifications", label: "Thông báo", icon: Bell, group: "Hệ thống" },
    ];
  }
  if (role === "MANAGER") {
    return [
      { href: "/", label: "Tổng quan", icon: LayoutDashboard, group: "Chung" },
      { href: "/team", label: "Nhóm của tôi", icon: Users, group: "Nhân sự" },
      { href: "/employees", label: "Nhân sự", icon: Briefcase, group: "Nhân sự" },
      { href: "/leave", label: "Nghỉ phép", icon: CalendarDays, group: "Thời gian" },
      { href: "/attendance", label: "Chấm công", icon: ClipboardList, group: "Thời gian" },
      { href: "/payroll", label: "Lương", icon: Wallet, group: "Lương" },
      { href: "/reports", label: "Báo cáo", icon: FileText, group: "Hệ thống" },
      { href: "/notifications", label: "Thông báo", icon: Bell, group: "Hệ thống" },
    ];
  }
  if (role === "AUDITOR") {
    return [
      { href: "/", label: "Tổng quan", icon: LayoutDashboard, group: "Chung" },
      { href: "/employees", label: "Nhân sự", icon: Users, group: "Nhân sự" },
      { href: "/payroll", label: "Lương", icon: Wallet, group: "Lương" },
      { href: "/reports", label: "Báo cáo", icon: FileText, group: "Hệ thống" },
      { href: "/audit", label: "Nhật ký", icon: Settings2, group: "Hệ thống" },
    ];
  }
  return [
    { href: "/", label: "Tổng quan", icon: LayoutDashboard, group: "Chung" },
    { href: "/employees", label: "Hồ sơ nhân viên", icon: Users, group: "Nhân sự" },
    { href: "/contracts", label: "Hợp đồng", icon: FileText, group: "Nhân sự" },
    { href: "/leave", label: "Nghỉ phép", icon: CalendarDays, group: "Thời gian" },
    { href: "/attendance", label: "Chấm công", icon: ClipboardList, group: "Thời gian" },
    { href: "/payroll", label: "Kỳ lương", icon: Wallet, group: "Lương" },
    { href: "/payroll/adjustments", label: "Tạm ứng / truy lĩnh", icon: Wallet, group: "Lương" },
    { href: "/statutory", label: "Tham số luật", icon: Scale, group: "Lương" },
    { href: "/reports", label: "Báo cáo", icon: FileText, group: "Hệ thống" },
    { href: "/audit", label: "Nhật ký", icon: Settings2, group: "Hệ thống" },
    { href: "/notifications", label: "Thông báo", icon: Bell, group: "Hệ thống" },
  ];
}

function active(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/payroll") return path === "/payroll" || /^\/payroll\/[^/]+$/.test(path);
  return path === href || path.startsWith(`${href}/`);
}

export function Shell({ me, path, unread = 0, children }: { me: Me; path: string; unread?: number; children: React.ReactNode }) {
  const items = linksFor(me.role);
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_1fr]">
      <aside className="flex flex-col border-b border-border bg-card lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">SN</div>
          <div>
            <div className="text-sm font-semibold leading-tight">Sổ Nhân</div>
            <div className="text-[11px] text-muted-foreground">Nhân sự · lương · bảo hiểm</div>
          </div>
        </div>
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <Building2 className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <div className="text-xs font-medium">Công ty TNHH Sổ Nhân</div>
            <div className="text-[11px] text-muted-foreground">MST 0312345678 · 9/2026</div>
          </div>
        </div>
        <nav className="flex-1 overflow-auto px-2 pb-3">
          {groups.map((group) => (
            <div key={group} className="mb-2">
              <div className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group}</div>
              {items.filter((item) => item.group === group).map((item) => {
                const on = active(path, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] ${
                      on ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/80 hover:bg-accent"
                    }`}
                  >
                    <Icon className="size-4 shrink-0 opacity-90" />
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/notifications" && unread > 0 ? (
                      <span className="grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-border px-3 py-3">
          <div className="grid size-9 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">{initials(me.fullName)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{me.fullName}</div>
            <div className="text-xs text-muted-foreground">{roleLabel[me.role]}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur">
          <form action="/employees" className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-muted-foreground">
            <Search className="size-4" />
            <input name="q" placeholder="Tìm nhân viên theo tên, mã, chức danh…" className="h-full w-full border-0 bg-transparent p-0 shadow-none focus:ring-0" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <span className="chip hidden sm:inline-flex">Kỳ lương 09/2026</span>
            <Link href="/notifications" className="relative grid size-9 place-items-center rounded-md border border-border hover:bg-accent" aria-label="Thông báo">
              <Bell className="size-4" />
              {unread > 0 ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-card bg-red-500" /> : null}
            </Link>
            <div className="grid size-9 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">{initials(me.fullName)}</div>
          </div>
        </header>
        <main className="flex-1 p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
