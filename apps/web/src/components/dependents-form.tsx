"use client";

import { useState } from "react";

type Person = { fullName: string; relation: string; birthDate: string; warning?: string | null };

const relations = [
  ["CHILD", "Con"],
  ["SPOUSE", "Vợ/chồng"],
  ["PARENT", "Cha/mẹ"],
  ["OTHER", "Khác"],
];

export function DependentsForm({ employeeId, people, count }: { employeeId: string; people: Person[]; count: number }) {
  const [rows, setRows] = useState<Person[]>(
    people.map((person) => ({ ...person, birthDate: person.birthDate.slice(0, 10) })),
  );

  return (
    <form
      className="form"
      onSubmit={async (event) => {
        event.preventDefault();
        const next = rows.filter((item) => item.fullName.trim() || item.birthDate);
        if (next.length !== count && !confirm(`Lưu sẽ đổi số người phụ thuộc đang tính lương từ ${count} thành ${next.length}. Kỳ đã khóa không bị tính lại.`)) return;
        const response = await fetch(`/backend/api/employees/${employeeId}/dependents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ people: next }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          alert(body.message ?? "Không lưu được");
          return;
        }
        window.location.reload();
      }}
    >
      <h2>Người phụ thuộc</h2>
      <p className="muted">Đang tính lương theo {count} người. Danh sách này thay số đó ở kỳ chưa khóa.</p>
      {rows.map((person, index) => (
        <div key={index} style={{ marginBottom: 8 }}>
          <div className="row">
            <input
              value={person.fullName}
              placeholder="Họ tên"
              style={{ width: 180 }}
              onChange={(event) => update(index, { fullName: event.target.value })}
            />
            <select value={person.relation} style={{ width: 120 }} onChange={(event) => update(index, { relation: event.target.value })}>
              {relations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input type="date" value={person.birthDate} style={{ width: 150 }} onChange={(event) => update(index, { birthDate: event.target.value })} />
            <button type="button" className="btn-line" onClick={() => setRows(rows.filter((_, item) => item !== index))}>Bỏ</button>
          </div>
          {person.warning ? <p className="warn">{person.warning}</p> : null}
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn-line" onClick={() => setRows([...rows, { fullName: "", relation: "CHILD", birthDate: "" }])}>Thêm người</button>
        <button className="btn" type="submit">Lưu</button>
      </div>
    </form>
  );

  function update(index: number, patch: Partial<Person>) {
    setRows(rows.map((row, item) => (item === index ? { ...row, ...patch, warning: null } : row)));
  }
}
