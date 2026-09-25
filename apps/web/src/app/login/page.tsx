"use client";

import { useState } from "react";

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
    <div className="login-wrap">
      <section className="hero">
        <div>
          <div className="k">Sổ Nhân · HRMS Việt Nam</div>
          <h1>Quản trị con người như sổ cái, không như file Excel.</h1>
          <p>Hồ sơ, chấm công, nghỉ phép, BHXH và thuế TNCN đi cùng một kỳ lương — khóa được, giải trình được, đối chiếu ngân hàng được.</p>
          <ul className="hero-list">
            <li><i>✓</i> Kỳ lương song song, sai lệch phải có lý do</li>
            <li><i>✓</i> Pack luật 2026: BHXH 21,5/10,5 · PIT 5 bậc</li>
            <li><i>✓</i> ESS / MSS theo vai trò, nhật ký kiểm toán</li>
            <li><i>✓</i> File ngân hàng có checksum, không gửi nhầm người</li>
          </ul>
        </div>
        <p style={{ fontSize: 13, opacity: 0.7 }}>Một codebase · ba tiến trình · dành cho doanh nghiệp khoảng 5.000 người.</p>
      </section>
      <section className="panel">
        <form className="form" onSubmit={onSubmit}>
          <div>
            <div className="k" style={{ color: "var(--accent-2)" }}>Đăng nhập hệ thống</div>
            <h2>Chào mừng trở lại</h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>Dùng tài khoản nội bộ. Mật khẩu demo Sonhan@2026.</p>
          </div>
          <label>
            Email công ty
            <input name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Mật khẩu
            <input name="password" type="password" autoComplete="current-password" defaultValue="Sonhan@2026" required />
          </label>
          {error ? <p className="warn">{error}</p> : null}
          <button className="btn" disabled={pending}>{pending ? "Đang vào…" : "Vào làm việc"}</button>
          <div>
            <p className="muted" style={{ fontSize: 12, margin: "0 0 6px" }}>Thử nhanh vai trò</p>
            <div className="demo-chips">
              {demos.map(([addr, label]) => (
                <button key={addr} type="button" onClick={() => setEmail(addr)}>{label}</button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
