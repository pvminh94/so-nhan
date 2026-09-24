import { createHash, randomBytes } from "crypto";
import type { Request, Response } from "express";
import type { Role, User } from "@prisma/client";

export const COOKIE = "sn_session";
export const SALARY_ROLES: Role[] = ["ADMIN", "HR", "PAYROLL"];

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function setSessionCookie(res: Response, token: string) {
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`);
}

export function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export type AuthUser = User;

export function canSeeSalary(role: Role, userEmployeeId: string | null, targetEmployeeId: string): boolean {
  if (SALARY_ROLES.includes(role)) return true;
  return Boolean(userEmployeeId && userEmployeeId === targetEmployeeId);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) return forwarded.split(",")[0].trim();
  return req.ip || "local";
}

const loginHits = new Map<string, number[]>();

export function assertLoginAllowed(ip: string) {
  const now = Date.now();
  const recent = (loginHits.get(ip) ?? []).filter((at) => now - at < 10 * 60 * 1000);
  if (recent.length >= 20) {
    throw new Error("Quá nhiều lần đăng nhập. Thử lại sau ít phút.");
  }
  recent.push(now);
  loginHits.set(ip, recent);
}

export function hashMeta(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
