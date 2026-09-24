"use client";

type Period = {
  periodLocked: boolean;
  missing: string[];
  open: string[];
  payrollLocked: boolean;
  canLock: boolean;
  canUnlock: boolean;
};

export function AttendanceLock({ period, canManage }: { period: Period; canManage: boolean }) {
  if (!canManage) return null;
  async function act(path: "lock" | "unlock") {
    const response = await fetch(`/backend/api/attendance/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-09" }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(body.message ?? "Không khóa được kỳ công");
      return;
    }
    window.location.reload();
  }
  return (
    <article className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2>{period.periodLocked ? "Kỳ công đã khóa" : "Kỳ công đang mở"}</h2>
          <p className="muted">Phải khóa bảng công trước khi tính lương. Kỳ lương đã khóa thì không mở lại.</p>
          {period.missing.length ? <p className="warn">Thiếu công: {period.missing.join(", ")}</p> : null}
        </div>
        {period.canLock ? <button className="btn" onClick={() => act("lock")}>Khóa kỳ công</button> : null}
        {period.canUnlock ? <button className="btn-line" onClick={() => act("unlock")}>Mở lại</button> : null}
      </div>
    </article>
  );
}
