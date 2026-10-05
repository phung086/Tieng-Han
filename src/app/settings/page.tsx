import { SettingsClient } from "@/components/settings-client";

export default function SettingsPage() {
  return <div className="page"><header className="page-header compact"><div><span className="kicker">CÀI ĐẶT · 설정</span><h1>Một app cá nhân, không cần phức tạp</h1><p>Giữ dữ liệu và hành vi local trước; khi production chỉ thêm những gì thực sự cần.</p></div></header><SettingsClient /></div>;
}
