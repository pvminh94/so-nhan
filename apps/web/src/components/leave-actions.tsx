"use client";

import { useState } from "react";

export function LeaveRequestForm({ enabled }: { enabled: boolean }) {
  const [message, setMessage] = useState("");
  if (!enabled) return null;
  return (
    <form
      className="form"
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
        setMessage(response.ok ? "Đã gửi đơn." : "Không gửi được đơn.");
        if (response.ok) window.location.reload();
      }}
    >
      <div className="row">
        <select name="type" style={{ width: 160 }}>
          <option value="ANNUAL">Phép năm</option>
          <option value="UNPAID">Không lương</option>
          <option value="SICK">Ốm đau</option>
        </select>
        <input name="startDate" type="date" required style={{ width: 160 }} />
        <input name="endDate" type="date" required style={{ width: 160 }} />
        <input name="days" type="number" min="0.5" step="0.5" placeholder="Số ngày" required style={{ width: 110 }} />
      </div>
      <textarea name="reason" placeholder="Lý do" required rows={2} />
      <button className="btn">Gửi đơn</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}

export function DecideButtons({ id }: { id: string }) {
  async function decide(status: "APPROVED" | "REJECTED") {
    await fetch(`/backend/api/leave/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    window.location.reload();
  }
  return (
    <span className="row">
      <button className="btn" onClick={() => decide("APPROVED")}>Duyệt</button>
      <button className="btn-line" onClick={() => decide("REJECTED")}>Từ chối</button>
    </span>
  );
}
