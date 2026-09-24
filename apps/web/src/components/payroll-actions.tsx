"use client";

export function PayrollActions({ canRun, runId, locked }: { canRun: boolean; runId?: string; locked?: boolean }) {
  if (!canRun) return null;
  return (
    <div className="row">
      <button
        className="btn"
        onClick={async () => {
          await fetch("/backend/api/payroll/runs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ year: 2026, month: 9 }),
          });
          window.location.href = "/payroll";
        }}
      >
        Tính lại 09/2026
      </button>
      {runId && !locked ? (
        <button
          className="btn-line"
          onClick={async () => {
            await fetch(`/backend/api/payroll/runs/${runId}/lock`, { method: "POST" });
            window.location.reload();
          }}
        >
          Khóa kỳ
        </button>
      ) : null}
      {runId ? <a className="btn-line" href={`/backend/api/payroll/runs/${runId}/bank.csv`}>File ngân hàng</a> : null}
    </div>
  );
}
