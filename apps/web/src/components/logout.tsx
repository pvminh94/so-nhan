"use client";

import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button
      type="button"
      title="Đăng xuất"
      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={async () => {
        await fetch("/backend/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      <LogOut className="size-4" />
    </button>
  );
}
