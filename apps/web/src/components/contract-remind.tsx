"use client";

export function ContractRemind({ canRemind }: { canRemind: boolean }) {
  if (!canRemind) return null;
  return (
    <button
      className="btn"
      onClick={async () => {
        const response = await fetch("/backend/api/contracts/remind", { method: "POST" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          alert(body.message ?? "Không gửi được nhắc hạn");
          return;
        }
        alert(body.sent ? `Đã gửi ${body.sent} nhắc hạn` : "Không có hợp đồng mới cần nhắc trong 7 ngày");
        window.location.href = "/notifications";
      }}
    >
      Nhắc hạn
    </button>
  );
}
