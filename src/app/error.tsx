"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="system-state">
      <div className="brand-mark">ㅎ</div>
      <strong>Có lỗi khi mở nội dung</strong>
      <span>Dữ liệu local của bạn vẫn được giữ. Hãy thử tải lại phần này.</span>
      <button className="primary-button" onClick={reset}>Thử lại</button>
    </div>
  );
}
