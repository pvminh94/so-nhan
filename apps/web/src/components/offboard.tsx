"use client";

export function OffboardForm({ id }: { id: string }) {
  return (
    <form
      className="form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (!confirm("Khóa hồ sơ nghỉ việc? Người này sẽ ra khỏi kỳ lương sau.")) return;
        const response = await fetch(`/backend/api/employees/${id}/offboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastDay: data.get("lastDay"), reason: data.get("reason") }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          alert(body.message ?? "Không nghỉ việc được");
          return;
        }
        window.location.reload();
      }}
    >
      <h2>Nghỉ việc</h2>
      <div className="row">
        <input name="lastDay" type="date" required style={{ width: 170 }} />
        <input name="reason" placeholder="Lý do" required style={{ width: 260 }} />
        <button className="btn-line">Chốt nghỉ việc</button>
      </div>
    </form>
  );
}
