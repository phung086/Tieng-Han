"use client";

import { Database, RotateCcw, ShieldCheck } from "lucide-react";
import { useLearning } from "@/lib/learning-state";

export function SettingsClient() {
  const { state, resetProgress } = useLearning();

  return (
    <div className="settings-stack">
      <section className="settings-card">
        <div className="settings-icon"><Database size={21} /></div>
        <div><h2>Dữ liệu học local</h2><p>Tiến độ hiện được lưu trong localStorage của trình duyệt này. Không có tài khoản hay server bắt buộc.</p></div>
        <span className="settings-badge">{state.xp} XP</span>
      </section>
      <section className="settings-card">
        <div className="settings-icon"><ShieldCheck size={21} /></div>
        <div><h2>Chế độ riêng tư</h2><p>Speech/TTS dùng khả năng của trình duyệt. Khi thêm AI hoặc cloud sau này, từng tính năng sẽ có cấu hình riêng.</p></div>
        <span className="settings-badge good">Local first</span>
      </section>
      <section className="settings-card danger-zone">
        <div className="settings-icon"><RotateCcw size={21} /></div>
        <div><h2>Đặt lại tiến độ demo</h2><p>Xóa kết quả luyện tập local và quay về trạng thái mẫu ban đầu.</p></div>
        <button className="secondary-button" onClick={() => { if (window.confirm("Đặt lại toàn bộ tiến độ demo?")) resetProgress(); }}>Đặt lại dữ liệu</button>
      </section>
    </div>
  );
}
