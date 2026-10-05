"use client";

import { Star, Zap } from "lucide-react";
import { useLearning } from "@/lib/learning-state";

export function DashboardLiveStats() {
  const { state } = useLearning();
  const total = Object.values(state.skills).reduce((sum, item) => sum + item.total, 0);
  const correct = Object.values(state.skills).reduce((sum, item) => sum + item.correct, 0);
  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  return <div className="header-stats"><div><Zap size={18} /><span><strong>{state.xp}</strong> XP</span></div><div><Star size={18} /><span><strong>{accuracy}%</strong> chính xác</span></div></div>;
}
