"use client";

import Link from "next/link";
import { Database, FileUp, RotateCcw, ShieldCheck } from "lucide-react";
import { useLearning } from "@/lib/learning-state";
import { useContent } from "@/lib/content-store";

export function SettingsClient() {
  const { state, resetProgress } = useLearning();
  const { course, resetCourse } = useContent();

  function resetAll() {
    if (!window.confirm("Đặt lại giáo trình và toàn bộ tiến độ local?")) return;
    resetProgress();
    resetCourse();
  }

  return (
    <div className="settings-stack">
      <section className="settings-card">
        <div className="settings-icon"><Database size={21} /></div>
        <div><h2>Dữ liệu học local</h2><p>Tiến độ và giáo trình đã nhập được lưu trong trình duyệt này. Không cần tài khoản hay database server.</p></div>
        <span className="settings-badge">{state.xp} XP</span>
      </section>

      <section className="settings-card">
        <div className="settings-icon"><FileUp size={21} /></div>
        <div><h2>Nhập giáo trình từ PDF</h2><p>Đưa giáo trình và workbook vào Content Ingestion Studio để tự tách bài và tạo nội dung học tập.</p></div>
        <Link className="secondary-button" href="/import">Mở Import Studio</Link>
      </section>

      <section className="settings-card">
        <div className="settings-icon"><ShieldCheck size={21} /></div>
        <div><h2>Giáo trình hiện tại</h2><p>{course.title} · {course.lessons.length} bài. API key AI chỉ được đọc server-side từ .env.local.</p></div>
        <span className="settings-badge good">Local first</span>
      </section>

      <section className="settings-card danger-zone">
        <div className="settings-icon"><RotateCcw size={21} /></div>
        <div><h2>Đặt lại toàn bộ</h2><p>Xóa giáo trình đã nhập và tiến độ học local, sau đó quay về dữ liệu demo.</p></div>
        <button className="secondary-button" onClick={resetAll}>Đặt lại dữ liệu</button>
      </section>
    </div>
  );
}
