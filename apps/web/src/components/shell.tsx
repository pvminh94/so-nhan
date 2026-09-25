import Link from "next/link";
import { roleLabel, type Me } from "@/lib/api";
import { LogoutButton } from "./logout";

type Item = { href: string; label: string; icon: string; group: string };

function linksFor(role: Me["role"]): Item[] {
  if (role === "EMPLOYEE") {
    return [
      { href: "/", label: "Tổng quan", icon: "home", group: "Chung" },
      { href: "/employees", label: "Hồ sơ của tôi", icon: "user", group: "Nhân sự" },
      { href: "/leave", label: "Nghỉ phép", icon: "leave", group: "Thời gian" },
      { href: "/payroll", label: "Phiếu lương", icon: "pay", group: "Lương" },
      { href: "/notifications", label: "Thông báo", icon: "bell", group: "Hệ thống" },
    ];
  }
  if (role === "MANAGER") {
    return [
      { href: "/", label: "Tổng quan", icon: "home", group: "Chung" },
      { href: "/team", label: "Nhóm của tôi", icon: "team", group: "Nhân sự" },
      { href: "/employees", label: "Nhân sự", icon: "user", group: "Nhân sự" },
      { href: "/leave", label: "Nghỉ phép", icon: "leave", group: "Thời gian" },
      { href: "/attendance", label: "Chấm công", icon: "clock", group: "Thời gian" },
      { href: "/payroll", label: "Lương", icon: "pay", group: "Lương" },
      { href: "/notifications", label: "Thông báo", icon: "bell", group: "Hệ thống" },
    ];
  }
  if (role === "AUDITOR") {
    return [
      { href: "/", label: "Tổng quan", icon: "home", group: "Chung" },
      { href: "/employees", label: "Nhân sự", icon: "user", group: "Nhân sự" },
      { href: "/payroll", label: "Lương", icon: "pay", group: "Lương" },
      { href: "/audit", label: "Nhật ký", icon: "log", group: "Hệ thống" },
    ];
  }
  return [
    { href: "/", label: "Tổng quan", icon: "home", group: "Chung" },
    { href: "/employees", label: "Hồ sơ nhân viên", icon: "user", group: "Nhân sự" },
    { href: "/contracts", label: "Hợp đồng", icon: "file", group: "Nhân sự" },
    { href: "/leave", label: "Nghỉ phép", icon: "leave", group: "Thời gian" },
    { href: "/attendance", label: "Chấm công", icon: "clock", group: "Thời gian" },
    { href: "/payroll", label: "Kỳ lương", icon: "pay", group: "Lương" },
    { href: "/payroll/adjustments", label: "Tạm ứng / truy lĩnh", icon: "pay", group: "Lương" },
    { href: "/statutory", label: "Tham số luật", icon: "law", group: "Lương" },
    { href: "/audit", label: "Nhật ký", icon: "log", group: "Hệ thống" },
    { href: "/notifications", label: "Thông báo", icon: "bell", group: "Hệ thống" },
  ];
}

function Icon({ name }: { name: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return <svg viewBox="0 0 24 24"><path {...p} d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></svg>;
    case "user":
      return <svg viewBox="0 0 24 24"><circle {...p} cx="12" cy="8" r="3.2" /><path {...p} d="M5 19.2c1.4-3.2 3.6-4.7 7-4.7s5.6 1.5 7 4.7" /></svg>;
    case "team":
      return <svg viewBox="0 0 24 24"><circle {...p} cx="9" cy="8" r="2.6" /><circle {...p} cx="16" cy="9" r="2.2" /><path {...p} d="M4 19c1.2-2.8 3-4.1 5.5-4.1S14 16.2 15 19M14.5 14.9c1.6-.2 3 .7 4.5 3.1" /></svg>;
    case "file":
      return <svg viewBox="0 0 24 24"><path {...p} d="M7 4h7l4 4v12H7z" /><path {...p} d="M14 4v4h4M9 13h6M9 17h4" /></svg>;
    case "leave":
      return <svg viewBox="0 0 24 24"><rect {...p} x="4" y="5" width="16" height="15" rx="2" /><path {...p} d="M8 3v4M16 3v4M4 10h16" /></svg>;
    case "clock":
      return <svg viewBox="0 0 24 24"><circle {...p} cx="12" cy="12" r="8" /><path {...p} d="M12 8v4.5l3 2" /></svg>;
    case "pay":
      return <svg viewBox="0 0 24 24"><rect {...p} x="3.5" y="6" width="17" height="12" rx="2" /><path {...p} d="M3.5 10h17M8 15h3" /></svg>;
    case "law":
      return <svg viewBox="0 0 24 24"><path {...p} d="M12 4v16M5 8h14M7 8c0 3 2.2 5 5 5s5-2 5-5M8 20h8" /></svg>;
    case "log":
      return <svg viewBox="0 0 24 24"><path {...p} d="M8 5h11v14H8zM5 8h3M5 12h3M5 16h3M11 9h5M11 13h5" /></svg>;
    default:
      return <svg viewBox="0 0 24 24"><path {...p} d="M6 8h12M6 12h12M6 16h8" /></svg>;
  }
}

function active(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/payroll") return path === "/payroll" || /^\/payroll\/[^/]+$/.test(path);
  return path === href || path.startsWith(`${href}/`);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "S";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "N";
  return (a + b).toUpperCase();
}

export function Shell({ me, path, unread = 0, children }: { me: Me; path: string; unread?: number; children: React.ReactNode }) {
  const items = linksFor(me.role);
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="mark">SN</div>
          <div>
            <b>Sổ Nhân</b>
            <span>Nhân sự · lương · bảo hiểm</span>
          </div>
        </div>
        <div className="company-chip">
          Công ty TNHH Sổ Nhân
          <small>Pháp nhân demo · 09/2026</small>
        </div>
        <nav className="nav">
          {groups.map((group) => (
            <div key={group}>
              <div className="nav-label">{group}</div>
              {items.filter((item) => item.group === group).map((item) => (
                <Link key={item.href} href={item.href} className={active(path, item.href) ? "active" : ""}>
                  <Icon name={item.icon} />
                  {item.label}
                  {item.href === "/notifications" && unread > 0 ? <span className="badge">{unread}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="who">
          <div className="avatar">{initials(me.fullName)}</div>
          <div>
            <b>{me.fullName}</b>
            <span>{roleLabel[me.role]}</span>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <form className="topbar-search" action="/employees">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3-3" /></svg>
            <input name="q" placeholder="Tìm nhân viên theo tên, mã, chức danh…" />
          </form>
          <div className="topbar-right">
            <span className="chip">Kỳ lương 09/2026</span>
            <Link href="/notifications" className="bell" aria-label="Thông báo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
              {unread > 0 ? <span className="dot" /> : null}
            </Link>
            <div className="avatar">{initials(me.fullName)}</div>
          </div>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
