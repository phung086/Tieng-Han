import { Pause, Play } from "lucide-react";
import type { useAutoAdvance } from "@/lib/use-auto-advance";

export function SessionFlowControl({ flow, stepKey }: { flow: ReturnType<typeof useAutoAdvance>; stepKey: string | number }) {
  return <div className="session-flow-control">
    <button type="button" aria-pressed={flow.enabled} onClick={flow.toggle}>{flow.enabled ? <Play size={14} /> : <Pause size={14} />}Tự chuyển câu đúng: {flow.enabled ? "Bật" : "Tắt"}</button>
    {flow.running ? <div key={stepKey} className="session-auto-next"><span>Tự tiếp tục sau 3,5 giây</span><button type="button" onClick={flow.pause}>Dừng để đọc giải thích</button><span className="session-auto-timer" aria-hidden="true" /></div> : null}
  </div>;
}
