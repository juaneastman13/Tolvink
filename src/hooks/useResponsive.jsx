import { useState, useEffect } from "react";

// ======================== MEDIA QUERY HOOK ============================
export function useIsDesktop(bp = 768) {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= bp);
  useEffect(() => {
    let timer;
    const handler = () => { clearTimeout(timer); timer = setTimeout(() => setIsDesktop(window.innerWidth >= bp), 150); };
    window.addEventListener('resize', handler);
    return () => { window.removeEventListener('resize', handler); clearTimeout(timer); };
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
