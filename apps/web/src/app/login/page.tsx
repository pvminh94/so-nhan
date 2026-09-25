"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const demos = [
  ["admin@sonhan.vn", "Quản trị"],
  ["hr@sonhan.vn", "Nhân sự"],
  ["payroll@sonhan.vn", "Lương"],
  ["quanly@sonhan.vn", "Quản lý"],
  ["nhanvien@sonhan.vn", "Nhân viên"],
];

export default function LoginPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("admin@sonhan.vn");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/backend/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    });
    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Không đăng nhập được" }));
      setError(body.message ?? "Không đăng nhập được");
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-14 text-zinc-100 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_400px_at_10%_-10%,oklch(0.5_0.14_155_/_0.35),transparent_55%)]" />
        <div className="relative">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-xs font-bold text-white">SN</div>
            <span className="text-sm font-medium">Sổ Nhân</span>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Phần mềm nhân sự Việt Nam</p>
          <h1 className="mt-3 max-w-[16ch] text-4xl font-semibold leading-tight text-white">Hồ sơ, công, phép và lương nằm cùng một chỗ.</h1>
          <p className="mt-4 max-w-[44ch] text-[15px] text-zinc-400">
            Tính xong khóa được. Mỗi dòng trên phiếu lương có công thức. Ốm đau và thai sản do quỹ BHXH chi, không trộn vào quỹ lương công ty.
          </p>
          <ul className="mt-8 grid gap-3 text-sm text-zinc-300">
            {[
              "Hai kỳ lương cạnh nhau, lệch là phải giải thích",
              "Luật 2026: BHXH 21,5% / 10,5%, thuế TNCN 5 bậc",
              "Nhân viên xin nghỉ, quản lý duyệt ngay trên máy",
              "File chuyển khoản ngân hàng có mã kiểm, lệch là dừng",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <span className="mt-0.5 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">✓</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-zinc-500">Một codebase · ba tiến trình · khoảng 5.000 người.</p>
      </section>
      <section className="grid place-items-center bg-background p-6">
        <form onSubmit={onSubmit} className="w-full max-w-[400px] space-y-4 rounded-xl border border-border bg-card p-7 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Đăng nhập</p>
            <h2 className="mt-1 text-xl font-semibold">Chào mừng trở lại</h2>
            <p className="mt-1 text-sm text-muted-foreground">Mật khẩu demo Sonhan@2026. Đổi trước khi có dữ liệu thật.</p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Email công ty
            <Input name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Mật khẩu
            <Input name="password" type="password" autoComplete="current-password" defaultValue="Sonhan@2026" required />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Đang vào…" : "Vào làm việc"}</Button>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Thử nhanh vai trò</p>
            <div className="flex flex-wrap gap-1.5">
              {demos.map(([addr, label]) => (
                <button key={addr} type="button" onClick={() => setEmail(addr)} className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                  {label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
