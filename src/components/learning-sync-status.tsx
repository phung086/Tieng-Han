"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, CloudOff, HardDrive, RefreshCw } from "lucide-react";
import { useLearning } from "@/lib/learning-state";

export function LearningSyncStatus() {
  const { syncStatus, canImportGuest, retrySync, importGuestProgress, resolveConflict } = useLearning();
  const [resolving, setResolving] = useState(false);
  const labels = { loading: "Đang tải tiến độ", local: "Tiến độ lưu trên máy này", saved: "Tiến độ đã đồng bộ", pending: "Đang lưu tiến độ…", offline: "Chưa đồng bộ được. Tiến độ vẫn được giữ trên máy này.", conflict: "Tiến độ ở phiên khác đã thay đổi. Chọn bản bạn muốn tiếp tục." };
  async function resolve(useLocal: boolean) {
    if (resolving) return;
    setResolving(true);
    try { await resolveConflict(useLocal); } finally { setResolving(false); }
  }
  return <div className={"learning-sync-status " + syncStatus}>
    <span role="status" aria-live="polite">{syncStatus === "saved" ? <CheckCircle2 size={16} /> : syncStatus === "local" ? <HardDrive size={16} /> : syncStatus === "offline" || syncStatus === "conflict" ? <CloudOff size={16} /> : <RefreshCw size={16} />}{labels[syncStatus]}</span>
    <div className="sync-actions">
      {syncStatus === "offline" ? <button type="button" onClick={retrySync}>Thử đồng bộ lại</button> : null}
      {syncStatus === "local" ? <Link href="/login">Đăng nhập để đồng bộ</Link> : null}
      {syncStatus === "conflict" ? <><button type="button" disabled={resolving} onClick={() => void resolve(true)}>Giữ bản trên máy này</button><button type="button" disabled={resolving} onClick={() => void resolve(false)}>Dùng bản đã đồng bộ</button></> : null}
      {canImportGuest ? <button type="button" onClick={importGuestProgress}>Nhập tiến độ đã học khi chưa đăng nhập</button> : null}
    </div>
  </div>;
}
