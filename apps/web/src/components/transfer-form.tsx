"use client";

import { useState } from "react";

export function TransferForm({
  employeeId,
  departments,
}: {
  employeeId: string;
  departments: Array<{ id: string; name: string }>;
}) {
  const [message, setMessage] = useState("");
  return (
    <form
      className="mt-3 grid gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const response = await fetch(`/backend/api/employees/${employeeId}/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: data.get("departmentId"),
            jobTitle: data.get("jobTitle"),
            reason: data.get("reason"),
            effectiveDate: data.get("effectiveDate"),
          }),
        });
        const body = await response.json().catch(() => ({}));
        setMessage(response.ok ? "Đã ghi quyết định điều chuyển." : body.message ?? "Không điều chuyển được.");
        if (response.ok) window.location.reload();
      }}
    >
      <h2>Điều chuyển / bổ nhiệm</h2>
      <div className="row">
        <select name="departmentId" required style={{ width: 200 }}>
          {departments.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <input name="jobTitle" placeholder="Chức danh mới" style={{ width: 200 }} />
        <input name="effectiveDate" type="date" required style={{ width: 160 }} />
      </div>
      <input name="reason" placeholder="Lý do, số quyết định" required />
      <button className="btn" type="submit">Ghi nhận</button>
      {message ? <p className={message.startsWith("Đã") ? "muted" : "warn"}>{message}</p> : null}
    </form>
  );
}
