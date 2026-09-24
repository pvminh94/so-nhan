"use client";

export function AttendanceImport({ canImport }: { canImport: boolean }) {
  if (!canImport) return null;
  return (
    <form
      className="form"
      style={{ marginBottom: 12 }}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const response = await fetch("/backend/api/attendance/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: "2026-09", csv: data.get("csv") }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          alert(body.message ?? "Không nhập được công");
          return;
        }
        window.location.reload();
      }}
    >
      <h2>Nhập công từ CSV</h2>
      <p className="muted">Cột: code,standardDays,workedDays,unpaidDays,otWeekdayHours,otWeekendHours,otHolidayHours,nightHours</p>
      <textarea name="csv" rows={4} required defaultValue={"code,standardDays,workedDays,unpaidDays,otWeekdayHours,otWeekendHours,otHolidayHours,nightHours\nNV009,22,22,0,12,4,0,6"} />
      <button className="btn">Nhập tháng 09/2026</button>
    </form>
  );
}
