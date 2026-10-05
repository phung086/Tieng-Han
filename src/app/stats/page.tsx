import { StatsClient } from "@/components/stats-client";

export default function StatsPage() {
  return (
    <div className="page">
      <header className="page-header compact">
        <div>
          <span className="kicker">TIẾN ĐỘ · 학습 기록</span>
          <h1>Nhìn tiến bộ, không nhìn áp lực</h1>
          <p>Độ chính xác theo kỹ năng cập nhật ngay sau các phiên luyện trên thiết bị này.</p>
        </div>
      </header>
      <StatsClient />
    </div>
  );
}
