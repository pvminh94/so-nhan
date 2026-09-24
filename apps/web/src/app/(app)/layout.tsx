import { Shell } from "@/components/shell";
import { api, requireMe } from "@/lib/api";
import { headers } from "next/headers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  const headerStore = await headers();
  const path = headerStore.get("x-pathname") ?? "/";
  const notes = await api<{ unread: number }>("/api/notifications");
  return (
    <Shell me={me} path={path} unread={notes?.unread ?? 0}>
      {children}
    </Shell>
  );
}
