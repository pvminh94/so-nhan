import { Shell } from "@/components/shell";
import { requireMe } from "@/lib/api";
import { headers } from "next/headers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  const headerStore = await headers();
  const path = headerStore.get("x-pathname") ?? "/";
  return (
    <Shell me={me} path={path}>
      {children}
    </Shell>
  );
}
