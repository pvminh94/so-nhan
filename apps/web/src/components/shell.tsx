import Link from "next/link";
import { roleLabel, type Me } from "@/lib/api";
import { LogoutButton } from "./logout";

function linksFor(role: Me["role"]): Array<[string, string]> {
  if (role === "EMPLOYEE") {
    return [
      ["/", "Tổng quan"],
      ["/employees", "Hồ sơ"],
      ["/leave", "Nghỉ phép"],
      ["/payroll", "Lương"],
      ["/notifications", "Thông báo"],
    ];
  }
  if (role === "MANAGER") {
    return [
      ["/", "Tổng quan"],
      ["/team", "Nhóm"],
      ["/employees", "Nhân sự"],
      ["/leave", "Nghỉ phép"],
      ["/attendance", "Chấm công"],
      ["/payroll", "Lương"],
      ["/notifications", "Thông báo"],
    ];
  }
  if (role === "AUDITOR") {
    return [
      ["/", "Tổng quan"],
      ["/employees", "Nhân sự"],
      ["/payroll", "Lương"],
      ["/audit", "Nhật ký"],
    ];
  }
  return [
    ["/", "Tổng quan"],
    ["/employees", "Nhân sự"],
    ["/leave", "Nghỉ phép"],
    ["/attendance", "Chấm công"],
    ["/contracts", "Hợp đồng"],
    ["/payroll", "Lương"],
    ["/statutory", "Tham số luật"],
    ["/audit", "Nhật ký"],
    ["/notifications", "Thông báo"],
  ];
}

export function Shell({ me, path, unread = 0, children }: { me: Me; path: string; unread?: number; children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="mark">SN</div>
          <div>
            <b>Sổ Nhân</b>
            <span>HRMS 5.000</span>
          </div>
        </div>
        <nav className="nav">
          {linksFor(me.role).map(([href, label]) => (
            <Link key={href} href={href} className={path === href ? "active" : ""}>
              {label}{href === "/notifications" && unread ? ` (${unread})` : ""}
            </Link>
          ))}
        </nav>
        <div className="who">
          <b>{me.fullName}</b>
          <span>{roleLabel[me.role]}</span>
          <LogoutButton />
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
