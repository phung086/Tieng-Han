import Link from "next/link";

export default function NotFound() {
  return (
    <div className="system-state">
      <div className="brand-mark">ㅎ</div>
      <strong>Không tìm thấy nội dung này</strong>
      <span>Bài học hoặc đường dẫn có thể chưa tồn tại trong giáo trình.</span>
      <Link className="primary-button" href="/">Về trang hôm nay</Link>
    </div>
  );
}
