"use client";

import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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
    <div className="login-wrap">
      <section className="hero">
        <div>
          <div className="k" style={{ color: "#e7c99a" }}>Sổ Nhân</div>
          <h1>Sổ cái con người, không phải file lương.</h1>
        </div>
        <p>Một kỳ lương khóa được. Phiếu lương giải thích từng dòng. Phép, công và thuế đi cùng nhau.</p>
      </section>
      <section className="panel">
        <form className="form" onSubmit={onSubmit}>
          <h2>Đăng nhập</h2>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" defaultValue="payroll@sonhan.vn" required />
          </label>
          <label>
            Mật khẩu
            <input name="password" type="password" autoComplete="current-password" defaultValue="Sonhan@2026" required />
          </label>
          {error ? <p className="warn">{error}</p> : null}
          <button className="btn" disabled={pending}>{pending ? "Đang vào..." : "Vào hệ thống"}</button>
          <p className="muted" style={{ fontSize: 13 }}>
            Demo: hr@sonhan.vn, payroll@sonhan.vn, quanly@sonhan.vn, nhanvien@sonhan.vn. Mật khẩu chung Sonhan@2026.
          </p>
        </form>
      </section>
    </div>
  );
}
