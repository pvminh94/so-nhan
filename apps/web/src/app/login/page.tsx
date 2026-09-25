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
          <h1>Hồ sơ, công, phép và lương nằm cùng một chỗ.</h1>
          <p>Tính xong khóa được. Mỗi dòng trên phiếu lương có công thức. Ốm đau và thai sản do quỹ BHXH chi, không trộn vào quỹ lương công ty.</p>
          <ul className="hero-list">
            <li><i>✓</i> Hai kỳ lương cạnh nhau, lệch là phải giải thích</li>
            <li><i>✓</i> Luật 2026: BHXH 21,5% / 10,5%, thuế TNCN 5 bậc</li>
            <li><i>✓</i> Nhân viên xin nghỉ, quản lý duyệt, nhân sự thấy hết</li>
            <li><i>✓</i> File chuyển khoản ngân hàng có mã kiểm, lệch là dừng</li>
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
