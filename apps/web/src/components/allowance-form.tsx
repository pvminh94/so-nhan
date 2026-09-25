"use client";

import { useState } from "react";

type Item = { code: string; name: string; amount: number; taxable: boolean };

export function AllowanceForm({ employeeId, items }: { employeeId: string; items: Item[] }) {
  const [rows, setRows] = useState<Item[]>(items.length ? items : [{ code: "", name: "", amount: 0, taxable: true }]);
  const [message, setMessage] = useState("");
  return (
    <form
      className="mt-3 grid gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const payload = rows.filter((item) => item.name.trim() && item.amount > 0);
        const response = await fetch(`/backend/api/employees/${employeeId}/allowances`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload }),
        });
        const body = await response.json().catch(() => ({}));
        setMessage(response.ok ? "Đã lưu phụ cấp. Tính lại kỳ lương để vào phiếu." : body.message ?? "Không lưu được.");
        if (response.ok) window.location.reload();
      }}
    >
      <h2>Phụ cấp</h2>
      {rows.map((row, index) => (
        <div className="row" key={index}>
          <input value={row.code} placeholder="Mã" style={{ width: 90 }} onChange={(e) => setRows(rows.map((item, i) => (i === index ? { ...item, code: e.target.value } : item)))} />
          <input value={row.name} placeholder="Tên phụ cấp" style={{ width: 180 }} onChange={(e) => setRows(rows.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)))} />
          <input type="number" min="0" step="1000" value={row.amount || ""} placeholder="Số tiền" style={{ width: 140 }} onChange={(e) => setRows(rows.map((item, i) => (i === index ? { ...item, amount: Number(e.target.value) } : item)))} />
          <label className="flex flex-row items-center gap-1.5 text-xs font-normal text-foreground">
            <input type="checkbox" checked={row.taxable} onChange={(e) => setRows(rows.map((item, i) => (i === index ? { ...item, taxable: e.target.checked } : item)))} className="size-4" />
            Chịu thuế
          </label>
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn-line" onClick={() => setRows([...rows, { code: "", name: "", amount: 0, taxable: true }])}>Thêm dòng</button>
        <button className="btn" type="submit">Lưu phụ cấp</button>
      </div>
      {message ? <p className={message.startsWith("Đã") ? "muted" : "warn"}>{message}</p> : null}
    </form>
  );
}
