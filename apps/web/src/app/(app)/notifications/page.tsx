import Link from "next/link";
import { MarkRead } from "@/components/mark-read";
import { api, dateVN, requireMe } from "@/lib/api";

type Note = { id: string; title: string; body: string; href: string | null; at: string; read: boolean };
type Box = { unread: number; items: Note[] };

export default async function NotificationsPage() {
  await requireMe();
  const box = await api<Box>("/api/notifications");
  return (
    <>
      <div className="top">
        <div>
          <h1>Thông báo</h1>
          <p className="sub">{box?.unread ?? 0} chưa đọc. Đơn phép gửi cho quản lý và nhân sự.</p>
        </div>
        <MarkRead disabled={!box?.unread} />
      </div>
      <article className="card">
        {box?.items.length ? box.items.map((item) => (
          <p key={item.id}>
            <b>{item.title}</b> · {dateVN(item.at)} {item.read ? "" : "· mới"}
            <br />
            {item.body} {item.href ? <Link href={item.href}>Mở</Link> : null}
          </p>
        )) : <p className="muted">Chưa có thông báo.</p>}
      </article>
    </>
  );
}
