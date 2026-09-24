"use client";

export function LogoutButton() {
  return (
    <button
      className="ghost"
      style={{ marginTop: 8, paddingLeft: 0 }}
      onClick={async () => {
        await fetch("/backend/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      Đăng xuất
    </button>
  );
}
