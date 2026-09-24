"use client";

export function MarkRead({ disabled }: { disabled: boolean }) {
  if (disabled) return null;
  return (
    <button
      className="btn-line"
      onClick={async () => {
        await fetch("/backend/api/notifications/read", { method: "POST" });
        window.location.reload();
      }}
    >
      Đánh dấu đã đọc
    </button>
  );
}
