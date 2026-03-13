import { useState, useEffect, useCallback, useRef } from "react";
import {
  apiGetNotifications, apiMarkNotificationRead, apiMarkAllRead, apiSubscribePush, VAPID_PUBLIC_KEY,
} from "../api";
import log from "../logger";

// ======================== NOTIFICATIONS HOOK ==========================
export function useNotifications(user) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const subscribedRef = useRef(false);

  // Subscribe to push notifications on first load
  useEffect(() => {
    if (!user || subscribedRef.current || !VAPID_PUBLIC_KEY) return;

    (async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          try {
            const key = Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
            sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
          } catch (keyError) {
            log.warn('PUSH', 'Invalid VAPID key or subscription failed:', keyError);
            return;
          }
        }

        const subJson = sub.toJSON();
        await apiSubscribePush({ endpoint: subJson.endpoint, keys: subJson.keys });
        subscribedRef.current = true;
        log.log('PUSH', 'Subscribed');
      } catch (e) {
        subscribedRef.current = false;
        log.warn('PUSH', 'Subscription failed:', e.message);
      }
    })();
  }, [user]);

  // Initial fetch of notifications — deferred 3s to prioritize freight load
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      if (!navigator.onLine) return;
      try {
        const r = await apiGetNotifications();
        setNotifications(r.notifications || []);
        setUnreadCount(r.unreadCount || 0);
      } catch (e) { log.warn('NOTIF', 'Fetch failed:', e.message); }
    };
    const t = setTimeout(fetchNotifications, 3000);
    return () => clearTimeout(t);
  }, [user]);

  const markRead = useCallback(async (id) => {
    try {
      await apiMarkNotificationRead(id);
      setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(p => Math.max(0, p - 1));
    } catch (e) { log.warn('NOTIF', 'Mark read failed:', e.message); }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiMarkAllRead();
      setNotifications(p => p.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) { log.warn('NOTIF', 'Mark all read failed:', e.message); }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await apiGetNotifications();
      setNotifications(r.notifications || []);
      setUnreadCount(r.unreadCount || 0);
    } catch (e) { log.warn('NOTIF', 'Refresh failed:', e.message); }
  }, []);

  return { notifications, unreadCount, markRead, markAllRead, refresh };
}
