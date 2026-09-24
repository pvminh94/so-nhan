"use client";

export function PayrollActions({ canRun, runId, status }: { canRun: boolean; runId?: string; status?: string }) {
  if (!canRun) return null;
  return (
    <div className="row">
      <button
        className="btn"
        onClick={async () => {
          const response = await fetch("/backend/api/payroll/runs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ year: 2026, month: 9 }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            alert(body.message ?? "Không tính được lương");
            return;
          }
          window.location.href = `/payroll/${body.id ?? ""}`;
        }}
      >
        Tính lại 09/2026
      </button>
      {runId && status === "CALCULATED" ? (
        <button
          className="btn-line"
          onClick={async () => {
            const response = await fetch(`/backend/api/payroll/runs/${runId}/lock`, { method: "POST" });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
              alert(body.message ?? "Không khóa được kỳ lương");
              return;
            }
            window.location.reload();
          }}
        >
          Khóa kỳ
        </button>
      ) : null}
      {runId ? <a className="btn-line" href={`/backend/api/payroll/runs/${runId}/bank.csv`}>File ngân hàng (đã đối soát)</a> : null}
      {runId ? <a className="btn-line" href={`/backend/api/payroll/runs/${runId}/journal.csv`}>Bút toán</a> : null}
    </div>
  );
}
