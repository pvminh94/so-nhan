"use client";

import { useMemo, useState } from "react";

const types = [
  { value: "ANNUAL", label: "Phép năm", hint: "Vẫn hưởng lương. Trừ vào quỹ phép năm." },
  { value: "UNPAID", label: "Nghỉ không lương", hint: "Không lương. Từ 14 ngày trong tháng thì không đóng BHXH tháng đó." },
  { value: "SICK", label: "Ốm đau", hint: "Công ty không trả lương. Quỹ BHXH trợ cấp 75% lương đóng, chia 24 ngày." },
  { value: "MATERNITY", label: "Thai sản", hint: "Công ty không trả lương. Quỹ BHXH trợ cấp 100% bình quân lương đóng 6 tháng." },
  { value: "OTHER", label: "Nghỉ việc riêng", hint: "Theo nội quy công ty." },
];

export function LeaveRequestForm({ enabled }: { enabled: boolean }) {
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("ANNUAL");
  const hint = useMemo(() => types.find((item) => item.value === kind)?.hint ?? "", [kind]);
  if (!enabled) return null;
  return (
    <form
      style={{ display: "grid", gap: 12 }}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const response = await fetch("/backend/api/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: data.get("type"),
            startDate: data.get("startDate"),
            endDate: data.get("endDate"),
            days: Number(data.get("days")),
            reason: data.get("reason"),
          }),
        });
        const body = await response.json().catch(() => ({}));
        setMessage(response.ok ? "Đã gửi đơn, chờ quản lý hoặc nhân sự duyệt." : body.message ?? "Không gửi được đơn.");
        if (response.ok) window.location.reload();
      }}
    >
      <h2>Gửi đơn nghỉ</h2>
      <div className="row">
        <select name="type" value={kind} onChange={(event) => setKind(event.target.value)} style={{ width: 200 }}>
          {types.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <input name="startDate" type="date" required style={{ width: 160 }} />
        <input name="endDate" type="date" required style={{ width: 160 }} />
        <input name="days" type="number" min="0.5" step="0.5" placeholder="Số ngày" required style={{ width: 120 }} />
      </div>
      <p className="muted" style={{ margin: 0 }}>{hint}</p>
      <textarea name="reason" placeholder="Lý do (viết rõ để người duyệt hiểu)" required rows={2} />
      <button className="btn">Gửi đơn</button>
      {message ? <p className={message.startsWith("Đã") ? "muted" : "warn"}>{message}</p> : null}
    </form>
  );
}

export function DecideButtons({ id }: { id: string }) {
  async function decide(status: "APPROVED" | "REJECTED") {
    const response = await fetch(`/backend/api/leave/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      alert(body.message ?? "Không duyệt được đơn này");
      return;
    }
    window.location.reload();
  }
  return (
    <span className="row">
      <button className="btn" onClick={() => decide("APPROVED")}>Duyệt</button>
      <button className="btn-line" onClick={() => decide("REJECTED")}>Từ chối</button>
    </span>
  );
}
