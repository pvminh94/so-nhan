import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";

export type Me = {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "HR" | "PAYROLL" | "MANAGER" | "EMPLOYEE" | "AUDITOR";
  employeeId: string | null;
};

export async function api<T>(path: string): Promise<T | null> {
  const jar = await cookies();
  const response = await fetch(`${base}${path}`, {
    headers: { cookie: jar.toString() },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function requireMe(): Promise<Me> {
  const me = await api<Me>("/api/auth/me");
  if (!me) redirect("/login");
  return me;
}

export function vnd(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("vi-VN").format(value) + " đ";
}

export function dateVN(value: string | Date) {
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

export const roleLabel: Record<Me["role"], string> = {
  ADMIN: "Quản trị",
  HR: "Nhân sự",
  PAYROLL: "Lương",
  MANAGER: "Quản lý",
  EMPLOYEE: "Nhân viên",
  AUDITOR: "Kiểm toán",
};
