import { useState, useEffect, useCallback, useRef } from "react";
import { C } from "../theme";

// ======================== TABLE SORT HOOK =============================
export function useTableSort() {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(null);
  const toggle = (col) => {
    if (sortCol !== col) { setSortCol(col); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortCol(null); setSortDir(null); }
  };
  const sortData = useCallback((data, getters) => {
    if (!sortCol || !sortDir || !getters[sortCol]) return data;
    const getter = getters[sortCol];
    return [...data].sort((a, b) => {
      let va = getter(a), vb = getter(b);
      if (va == null) va = "";
      if (vb == null) vb = "";
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
      const da = new Date(va), db = new Date(vb);
      if (!isNaN(da) && !isNaN(db) && String(va).length > 4) return sortDir === "asc" ? da - db : db - da;
      const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase();
      const cmp = sa.localeCompare(sb, "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sortCol, sortDir]);
  return { sortCol, sortDir, toggle, sortData };
}

// ======================== PULL TO REFRESH =============================
export function usePullToRefresh(onRefresh) {
  const containerRef = useRef(null);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDist = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop <= 0) startY.current = e.touches[0].clientY;
      else startY.current = 0;
    };
    const onTouchMove = (e) => {
      if (!startY.current || refreshingRef.current) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 10 && el.scrollTop <= 0) {
        pullDist.current = Math.min(diff, 100);
        const isPulling = pullDist.current > 50;
        if (isPulling !== pullingRef.current) { pullingRef.current = isPulling; setPulling(isPulling); }
      }
    };
    const onTouchEnd = async () => {
      if (pullingRef.current && !refreshingRef.current) {
        refreshingRef.current = true; setRefreshing(true);
        pullingRef.current = false; setPulling(false);
        try { await onRefreshRef.current(); } catch { /* refresh failed — UI recovers */ }
        refreshingRef.current = false; setRefreshing(false);
      }
      startY.current = 0;
      pullDist.current = 0;
      pullingRef.current = false; setPulling(false);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const indicator = (refreshing || pulling) ? (
    <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12.1, fontWeight: 600, color: refreshing ? C.pri : C.t3 }}>
      {refreshing ? "Actualizando..." : "Soltar para actualizar"}
    </div>
  ) : null;

  return { containerRef, indicator, refreshing };
}
