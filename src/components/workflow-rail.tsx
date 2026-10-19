import { AlertTriangle, Check, Circle, Clock3, Radio } from "lucide-react";
import type { WorkflowState } from "@/lib/workflow-state";

export function WorkflowRail({ state, checkedAt }: { state: WorkflowState; checkedAt: number }) {
  const minutes = Math.max(0, Math.floor((checkedAt - state.lastActivity) / 60_000));
  return <section className="workflow-rail" data-tone={state.tone} aria-label="Tiến trình được xác nhận">
    <div className="workflow-rail-heading"><div className="workflow-rail-title">{state.tone === "error" || state.tone === "warning" ? <AlertTriangle size={20} /> : <Radio size={20} />}<strong role="status">{state.title}</strong></div><span><Clock3 size={14} />{minutes < 1 ? "Vừa có hoạt động" : `${minutes} phút chưa có hoạt động mới`}</span></div>
    <ol>{state.steps.map(step => <li key={step.label} data-state={step.state} aria-current={step.state === "current" || step.state === "blocked" ? "step" : undefined}><span className="workflow-step-icon">{step.state === "done" ? <Check size={16} /> : step.state === "blocked" ? <AlertTriangle size={16} /> : <Circle size={12} />}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></li>)}</ol>
    <p>{state.note}</p>
  </section>;
}
