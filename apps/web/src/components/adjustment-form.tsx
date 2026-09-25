"use client";

import { useState } from "react";

type Person = { id: string; code: string; fullName: string };

export function AdjustmentForm({ people }: { people: Person[] }) {
  const [message, setMessage] = useState("");
  return (
    <form
      style={{ display: "grid", gap: 12 }}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const response = await fetch("/backend/api/payroll/adjustments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: data.get("employeeId"),
            year: 2026,
            month: 9,
            kind: data.get("kind"),
            amount: Number(data.get("amount")),
            reason: data.get("reason"),
          }),
        });
        const body = await response.json().catch(() => ({}));
        setMessage(response.ok ? "Đã ghi. Tính lại kỳ lương để dòng này vào phiếu." : body.message ?? "Không ghi được.");
        if (response.ok) window.location.reload();
      }}
    >
      <h2>Ghi tạm ứng / truy lĩnh kỳ 09/2026</h2>
      <div className="row">
        <select name="employeeId" required style={{ width: 260 }}>
          {people.map((item) => (
            <option key={item.id} value={item.id}>{item.code} · {item.fullName}</option>
          ))}
        </select>
        <select name="kind" required style={{ width: 200 }}>
          <option value="ADVANCE">Tạm ứng lương</option>
          <option value="RETRO">Truy lĩnh</option>
          <option value="DEDUCTION">Khấu trừ khác</option>
        </select>
        <input name="amount" type="number" min="1000" step="1000" placeholder="Số tiền (đồng)" required style={{ width: 180 }} />
      </div>
      <input name="reason" placeholder="Lý do, ví dụ: ứng 15/09 hoặc truy lĩnh OT tháng 8" required />
      <button className="btn">Ghi nhận</button>
      {message ? <p className={message.startsWith("Đã") ? "muted" : "warn"}>{message}</p> : null}
    </form>
  );
}
