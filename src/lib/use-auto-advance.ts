"use client";

import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";

export const AUTO_ADVANCE_DELAY = 3500;
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("haneul-auto-advance", callback);
  document.addEventListener("visibilitychange", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("haneul-auto-advance", callback); document.removeEventListener("visibilitychange", callback); };
}
function preference() { try { return localStorage.getItem("haneul:auto-advance") !== "off"; } catch { return true; } }
function visible() { return !document.hidden; }
const serverValue = () => true;
export function useAutoAdvance(key: string | number, eligible: boolean, next: () => void) {
  const enabled = useSyncExternalStore(subscribe, preference, serverValue);
  const pageVisible = useSyncExternalStore(subscribe, visible, serverValue);
  const [temporaryOff, setTemporaryOff] = useState<boolean | null>(null);
  const [pausedKey, setPausedKey] = useState<string | number | null>(null);
  const advance = useEffectEvent(next);
  const on = temporaryOff ?? enabled;
  const running = on && eligible && pausedKey !== key && pageVisible;
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => { if (!document.hidden) advance(); }, AUTO_ADVANCE_DELAY);
    return () => clearTimeout(timer);
  }, [key, running]);
  function toggle() {
    try { localStorage.setItem("haneul:auto-advance", on ? "off" : "on"); window.dispatchEvent(new Event("haneul-auto-advance")); setTemporaryOff(null); }
    catch { setTemporaryOff(!on); }
  }
  return { enabled: on, running, toggle, pause: () => setPausedKey(key), reset: () => setPausedKey(null) };
}
