import { useState, useEffect } from "react";

// ======================== MEDIA QUERY HOOK ============================
export function useIsDesktop(bp = 768) {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= bp);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${bp}px)`);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [bp]);
  return isDesktop;
}

// ======================== ONLINE STATUS HOOK ==========================
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}
