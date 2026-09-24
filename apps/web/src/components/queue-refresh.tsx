"use client";

import { useEffect } from "react";

export function QueueRefresh({ status }: { status: string }) {
  useEffect(() => {
    if (status !== "QUEUED" && status !== "CALCULATING") return;
    const timer = window.setInterval(() => window.location.reload(), 1500);
    return () => window.clearInterval(timer);
  }, [status]);
  if (status !== "QUEUED" && status !== "CALCULATING") return null;
  return <p className="warn">Worker đang tính kỳ này. Trang sẽ tự tải lại.</p>;
}
