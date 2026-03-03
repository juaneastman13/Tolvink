import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { C, Ic, FONT } from "../theme";
import { Btn, Field, Tabs, Av, Loader, AttachMenu, FileViewer } from "../components";
import { apiSearchUsers, apiStartConversation, apiListConversations, apiGetMessages, apiSendMessage, apiMarkRead, apiTyping, apiToggleMarkUnread, uploadChatFile, thumb } from "../api";
import log from "../logger";

// Helper: format relative date
const formatDateDivider = (dateStr) => {
  const msgDate = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(msgDate, today)) return "Hoy";
  if (isSameDay(msgDate, yesterday)) return "Ayer";
  return msgDate.toLocaleDateString("es", { day: "2-digit", month: "short", year: msgDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
};

export default function ChatsScreen({ user, openConvId, onConvOpened, isDesktop, sseMsg, onSseMsgHandled, sseTyping, sseRead, sseConnected }) {
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newCompId, setNewCompId] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newErr, setNewErr] = useState(null);
  const [compSearchQ, setCompSearchQ] = useState("");
  const [compResults, setCompResults] = useState([]);
  const [compSearching, setCompSearching] = useState(false);
  const compSearchTimer = useRef(null);
  const [searchQ, setSearchQ] = useState("");
  const [viewFile, setViewFile] = useState(null);
  const [msgHasMore, setMsgHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const msgEndRef = useRef(null);
  const msgTopRef = useRef(null);
  const [typingUser, setTypingUser] = useState(null);
  const typingTimer = useRef(null);
  const typingSendTimer = useRef(null);
  const [peerReadAt, setPeerReadAt] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesContainerRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef(null);
  const [newMsgIndicator, setNewMsgIndicator] = useState(false);
  const [chatTab, setChatTab] = useState("chat"); // Moved up from line 338 (Issue #2)
  const prevMessagesLengthRef = useRef(0); // Issue #10 fix: track previous length
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // SSE: incoming message → instant refresh
  useEffect(() => {
    if (!sseMsg || !sseMsg.conversationId) return;
    if (activeConv && sseMsg.conversationId === activeConv.id) {
      // Append SSE message directly (avoid reloading 50 messages)
      if (sseMsg.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === sseMsg.id)) return prev;
          return [...prev, sseMsg];
        });
      }
      // Issue #1 fix: removed pollDelayRef.current (undefined in this scope)
    } else {
      // Different conversation — refresh list to update unread badges
      loadConvs();
    }
    if (onSseMsgHandled) onSseMsgHandled();
  }, [sseMsg, activeConv?.id]); // Issue #3 fix: added activeConv?.id dependency

  // SSE: typing indicator
  useEffect(() => {
    if (!sseTyping || !activeConv || sseTyping.conversationId !== activeConv.id) return;
    if (sseTyping.userId === user.id) return;
    setTypingUser(sseTyping.userName || "Alguien");
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTypingUser(null), 3000);
  }, [sseTyping, user.id, activeConv?.id]); // Issue #4 fix: added user.id, activeConv?.id

  // SSE: read receipt
  useEffect(() => {
    if (!sseRead || !activeConv || sseRead.conversationId !== activeConv.id) return;
    if (sseRead.readByUserId === user.id) return;
    setPeerReadAt(sseRead.readAt);
  }, [sseRead, user.id, activeConv?.id]); // Issue #5 fix: added user.id, activeConv?.id

  // Reset typing + read state when switching conversations
  useEffect(() => { setTypingUser(null); setPeerReadAt(null); }, [activeConv?.id]);

  // Autofocus input when opening conversation
  useEffect(() => {
    if (activeConv && inputRef.current && chatTab === "chat") {
      // Small delay to ensure DOM is ready
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeConv?.id, chatTab]);

  // Send typing indicator (debounced 2s)
  const sendTyping = useCallback(() => {
    if (!activeConv) return;
    clearTimeout(typingSendTimer.current);
    typingSendTimer.current = setTimeout(() => {
      apiTyping(activeConv.id).catch(()=>{});
    }, 300);
  }, [activeConv]);

  const loadConvs = useCallback(async () => {
    // Issue #11 fix: normalize input and output
    try {
      const query = searchQ?.trim() || undefined;
      const c = await apiListConversations(query);
      const result = Array.isArray(c) ? c : [];
      setConvs(result);
      return result;
    } catch (err) {
      console.warn('[CHATS] loadConvs failed:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [searchQ]);

  // CRITICAL FIX #3: Define openConv BEFORE useEffect that calls it
  const openConv = useCallback(async (conv) => {
    setActiveConv(conv);
    setMsgHasMore(false);
    try {
      const r = await apiGetMessages(conv.id, {take:50});
      const msgs = Array.isArray(r) ? r : (r?.messages || []); // Issue #21 fix
      setMessages(msgs);
      setMsgHasMore(Array.isArray(r) ? false : (r?.hasMore || false));
      // Issue #13 fix: log mark-read failures
      apiMarkRead(conv.id).catch((e) => console.warn('[CHATS] Mark read failed:', e));
    } catch (err) {
      console.warn('[CHATS] openConv failed:', err);
    }
  }, []); // No dependencies - uses setState which is stable

  // Load initial conversations + handle openConvId
  useEffect(() => {
    loadConvs().then(cs => {
      if(openConvId) {
        const found = cs.find(c=>c.id===openConvId);
        if(found) { openConv(found); }
        else { openConv({id:openConvId}); }
        if(onConvOpened) onConvOpened();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConvId, openConv]);

  // Reload when search changes (debounced)
  useEffect(() => {
    const t = setTimeout(() => loadConvs(), 300);
    return () => clearTimeout(t);
  }, [searchQ, loadConvs]); // Issue #6 fix: added loadConvs dependency

  const loadOlderMessages = useCallback(async () => {
    if(!activeConv || loadingOlder || !msgHasMore || messagesRef.current.length===0) return;
    setLoadingOlder(true);
    try {
      const oldestId = messagesRef.current[0]?.id;
      const r = await apiGetMessages(activeConv.id, {take:50, before:oldestId});
      const older = r.messages || [];
      if(older.length>0) {
        setMessages(prev => {
          const ids = new Set(prev.map(m=>m.id));
          return [...older.filter(m=>!ids.has(m.id)), ...prev];
        });
      }
      setMsgHasMore(r.hasMore || false);
    } catch {} finally { setLoadingOlder(false); }
  }, [activeConv, loadingOlder, msgHasMore]);

  // Smart scroll: only auto-scroll when at bottom (new messages), NOT when loading older
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    const hasNewMessages = messages.length > prevLength;

    if (isAtBottom && msgEndRef.current) {
      msgEndRef.current.scrollIntoView({ behavior: "smooth" });
      setNewMsgIndicator(false); // Issue #12 fix: clear when at bottom
    } else if (hasNewMessages && !isAtBottom) {
      // Issue #10 fix: only show indicator if NEW messages arrived while not at bottom
      setNewMsgIndicator(true);
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, isAtBottom]);

  const scrollToBottom = () => {
    setIsAtBottom(true);
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMsgIndicator(false);
  };

  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const copyMessageText = (text, msgId) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    }).catch(() => {});
  };

  // Parse @ mentions in text
  const renderTextWithMentions = (text, mine) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} style={{ background: mine ? "rgba(255,255,255,0.25)" : C.accPale, padding: "1px 4px", borderRadius: 4, fontWeight: 600 }}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Toggle mark unread
  const handleToggleMarkUnread = async (convId, e) => {
    e?.stopPropagation();
    try {
      await apiToggleMarkUnread(convId);
      loadConvs();
    } catch (err) {
      log.error('Chat', 'mark unread failed:', err);
    }
  };

  // Track if user is at bottom of scroll + auto-load older on scroll-to-top
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);

    // Auto-load older messages when scrolling near top (infinite scroll)
    const atTop = scrollTop < 100;
    if (atTop && msgHasMore && !loadingOlder && messagesRef.current.length > 0) {
      loadOlderMessages();
    }
  }, [msgHasMore, loadingOlder, loadOlderMessages]);

  // Mobile keyboard handling: adjust layout when keyboard shows
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      const viewport = window.visualViewport;
      const windowHeight = window.innerHeight;
      const viewportHeight = viewport.height;
      const keyboardHeightCalc = windowHeight - viewportHeight;
      setKeyboardHeight(keyboardHeightCalc > 0 ? keyboardHeightCalc : 0);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  // Poll for new messages — SSE-aware: 60s base when SSE connected (fallback only), 3s→60s backoff when disconnected
  const pollDelayRef = useRef(60000);
  useEffect(() => {
    if (!activeConv) return;
    pollDelayRef.current = sseConnected ? 60000 : 3000;
    let timer = null;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || document.hidden) { if(!cancelled) timer = setTimeout(poll, pollDelayRef.current); return; }
      try {
        const r = await apiGetMessages(activeConv.id, {take:50});
        const fresh = Array.isArray(r) ? r : (r?.messages || []);
        setMessages(prev => {
          if(prev.length===0) return fresh;
          const ids = new Set(prev.map(m => m.id));
          const lastId = prev[prev.length-1]?.id;
          const lastIdx = fresh.findIndex(m=>m.id===lastId);
          if(lastIdx>=0 && lastIdx<fresh.length-1) {
            pollDelayRef.current = sseConnected ? 60000 : 3000;
            const newMsgs = fresh.slice(lastIdx+1).filter(m => !ids.has(m.id));
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
          }
          if (!sseConnected) pollDelayRef.current = Math.min(pollDelayRef.current * 1.5, 60000);
          return prev;
        });
      } catch {}
      if (!cancelled) timer = setTimeout(poll, pollDelayRef.current);
    };
    timer = setTimeout(poll, pollDelayRef.current);
    return () => { cancelled = true; if(timer) clearTimeout(timer); };
  }, [activeConv, sseConnected]);

  const handleSend = async () => {
    if (!msgText.trim() || !activeConv || sending) return;
    const textToSend = msgText.trim();
    const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

    // Optimistic update: show message immediately
    const optimisticMsg = {
      id: optimisticId,
      text: textToSend,
      senderId: user.id,
      sender: { id: user.id, name: user.name },
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setMsgText("");
    setSending(true);
    setSendError(null);

    try {
      const serverMsg = await apiSendMessage(activeConv.id, textToSend);
      // Replace optimistic message with confirmed server message
      setMessages(prev => prev.map(m => m.id === optimisticId ? serverMsg : m));
    } catch (err) {
      // Mark message as failed
      setMessages(prev => prev.map(m => m.id === optimisticId ? {...m, status: 'failed'} : m));
      setSendError("No se pudo enviar el mensaje. Intenta de nuevo.");
      setTimeout(() => setSendError(null), 5000);
    } finally {
      setSending(false);
    }
  };

  const retryFailedMessage = async (failedMsg) => {
    if (sending) return;
    setSending(true);
    setSendError(null);

    // Update to pending status
    setMessages(prev => prev.map(m => m.id === failedMsg.id ? {...m, status: 'pending'} : m));

    try {
      const serverMsg = await apiSendMessage(activeConv.id, failedMsg.text);
      setMessages(prev => prev.map(m => m.id === failedMsg.id ? serverMsg : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === failedMsg.id ? {...m, status: 'failed'} : m));
      setSendError("No se pudo enviar el mensaje. Intenta de nuevo.");
      setTimeout(() => setSendError(null), 5000);
    } finally {
      setSending(false);
    }
  };

  const [uploading, setUploading] = useState(false);
  const chatFileRef = useRef(null);
  const chatCamRef = useRef(null);
  const chatGalRef = useRef(null);
  // chatTab moved to line 54 (Issue #2 fix)
  const [showChatAttach, setShowChatAttach] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    if (file.size > 15 * 1024 * 1024) { alert("Máximo 15MB"); return; }
    e.target.value = "";
    setUploading(true);
    try {
      const url = await uploadChatFile(file, activeConv.id);
      const isImg = file.type.startsWith("image/");
      const tag = `[FILE:${url}|${isImg ? "image" : "document"}|${file.name}]`;
      const m = await apiSendMessage(activeConv.id, tag);
      setMessages(prev => [...prev, m]);
    } catch (err) { log.error("Chat", "upload failed:", err); }
    finally { setUploading(false); }
  };

  // Parse file messages
  const parseFileMsg = (text) => {
    const match = text?.match(/^\[FILE:(.*?)\|(.*?)\|(.*?)\]$/);
    if (!match) return null;
    const url = match[1]?.startsWith('https://') ? match[1] : null;
    return { url, type: match[2], name: match[3] };
  };

  // Collect all files from messages
  const chatFiles = useMemo(() => {
    return messages.filter(m => parseFileMsg(m.text)).map(m => ({
      ...parseFileMsg(m.text),
      sender: m.sender?.name || "Desconocido",
      date: m.createdAt,
      id: m.id,
    }));
  }, [messages]);

  // Search users by name for new chat
  const handleCompSearch = (q) => {
    setCompSearchQ(q);
    setNewCompId("");
    setNewUserId("");
    setNewErr(null);
    clearTimeout(compSearchTimer.current);
    if (q.trim().length < 2) { setCompResults([]); return; }
    setCompSearching(true);
    compSearchTimer.current = setTimeout(()=>{
      apiSearchUsers(q.trim()).then(r=>setCompResults(r||[])).catch(()=>setCompResults([])).finally(()=>setCompSearching(false));
    }, 300);
  };

  const handleSelectUser = (u) => {
    setNewCompId(u.company?.id || "");
    setNewUserId(u.id);
    setCompSearchQ(u.name + (u.company?.name ? ` (${u.company.name})` : ""));
    setCompResults([]);
  };

  const [startingConv, setStartingConv] = useState(false);
  const handleStartConv = async () => {
    if (!newUserId) { setNewErr("Buscá y seleccioná un usuario"); return; }
    if(startingConv) return;
    setStartingConv(true);
    setNewErr(null);
    try {
      const conv = await apiStartConversation({ targetUserId: newUserId });
      setShowNew(false); setNewCompId(""); setNewUserId(""); setCompSearchQ(""); setCompResults([]);
      loadConvs();
      openConv(conv);
    } catch (e) { setNewErr(e.message); }
    finally { setStartingConv(false); }
  };

  const getConvName = (conv) => {
    if (!conv) return "Chat";
    if (conv.freight) return `#${conv.freight.code} — ${conv.freight.destName || ""}`;
    // For direct conversations, find the other user by userId
    const otherP = (conv.participants || []).find(p => p.userId && p.userId !== user.id);
    if (otherP?.user?.name) return otherP.user.name;
    // Fallback: message sender name
    const lastMsg = conv.messages?.[0];
    if (lastMsg?.sender?.id !== user.id && lastMsg?.sender?.name) return lastMsg.sender.name;
    if (conv.displayName) return conv.displayName;
    return "Chat";
  };

  const getLastMsg = (conv) => {
    const m = conv.messages?.[0];
    if (!m) return "Sin mensajes";
    const fileMatch = m.text?.match(/^\[FILE:.*?\|(.*?)\|(.*?)\]$/);
    if (fileMatch) return `${m.sender?.name?.split(" ")[0] || ""}: 📎 ${fileMatch[2]}`;
    return `${m.sender?.name?.split(" ")[0] || ""}: ${m.text?.slice(0, 40)}${m.text?.length > 40 ? "..." : ""}`;
  };

  const getLastMsgTime = (conv) => {
    const m = conv.messages?.[0];
    if (!m?.createdAt) return "";
    return new Date(m.createdAt).toLocaleDateString("es",{day:"2-digit",month:"short"});
  };

  const stLabel = (s) => {
    const m = {pending_assignment:"Pendiente",assigned:"Asignado",accepted:"Aceptado",in_progress:"En viaje",loaded:"Cargado",finished:"Finalizado",canceled:"Cancelado"};
    return m[s]||s;
  };
  const stColor = (s) => {
    const m = {pending_assignment:C.warn,assigned:C.info,accepted:C.info,in_progress:C.acc,loaded:C.pri,finished:C.ok,canceled:C.muted};
    return m[s]||C.t3;
  };

  const [expandedGroups, setExpandedGroups] = useState({});
  const toggleGroup = (key) => setExpandedGroups(prev=>({...prev,[key]:!prev[key]}));
  const [groupBy, setGroupBy] = useState("planta"); // planta | transportista | productor

  // Helper: freight chat title — "Producto - Cantidad / Campo - Lote"
  const freightTitle = (f) => {
    const item = f?.items?.[0];
    const grain = item?.grain || "";
    const tons = item?.tons ? `${Number(item.tons)}t` : "";
    const fieldName = f?.field?.name || "";
    const lotName = f?.originLot?.name || "";
    const left = [grain, tons].filter(Boolean).join(" - ");
    const right = [fieldName, lotName].filter(Boolean).join(" - ");
    if (left && right) return `${left} / ${right}`;
    if (left) return left;
    if (right) return right;
    return `Flete ${f?.code || ""}`;
  };

  // Helper: get group key for a freight conversation based on groupBy mode
  const getGroupKey = useCallback((c) => {
    const f = c.freight;
    if (groupBy === "transportista") {
      const tc = f?.assignments?.[0]?.transportCompany?.name;
      return tc || "Sin transportista";
    }
    if (groupBy === "productor") return f?.originCompany?.name || "Sin productor";
    // planta (default)
    return f?.destName || f?.destCompany?.name || "Sin planta";
  }, [groupBy]);

  // Group conversations
  const grouped = useMemo(() => {
    const byCompany = {};
    const directConvs = [];
    const statusOrder = { in_progress: 0, loaded: 1, accepted: 2, assigned: 3, pending_assignment: 4, finished: 5, canceled: 6 };

    convs.forEach(c => {
      if (c.freight) {
        const key = getGroupKey(c);
        if (!byCompany[key]) byCompany[key] = { freightConvs: [] };
        byCompany[key].freightConvs.push(c);
      } else {
        const others = (c.participants || []).filter(p => p.userId && p.userId !== user.id);
        const otherUser = others.find(o => o.user?.name) || others[0];
        const lastMsg = c.messages?.[0];
        const msgSenderName = (lastMsg?.sender?.id && lastMsg.sender.id !== user.id) ? lastMsg.sender.name : null;
        const userName = otherUser?.user?.name || msgSenderName || "Chat";
        const companyName = otherUser?.company?.name || "";
        directConvs.push({ ...c, _userName: userName, _companyName: companyName });
      }
    });

    Object.values(byCompany).forEach(group => {
      group.freightConvs.sort((a, b) => {
        const sa = statusOrder[a.freight?.status] ?? 99;
        const sb = statusOrder[b.freight?.status] ?? 99;
        if (sa !== sb) return sa - sb;
        const dateA = new Date(b.messages?.[0]?.createdAt || 0).getTime();
        const dateB = new Date(a.messages?.[0]?.createdAt || 0).getTime();
        return dateA - dateB;
      });
    });

    directConvs.sort((a, b) => {
      return (b.messages?.[0]?.createdAt||"").localeCompare(a.messages?.[0]?.createdAt||"");
    });

    const getLatest = group => {
      let max = "";
      group.freightConvs.forEach(c => { const t = c.messages?.[0]?.createdAt||""; if(t>max) max=t; });
      return max;
    };
    const companyKeys = Object.keys(byCompany).sort((a, b) => getLatest(byCompany[b]).localeCompare(getLatest(byCompany[a])));

    return { companyKeys, byCompany, directConvs };
  }, [convs, user.id, getGroupKey]);

  // Chat detail view
  const chatDetailPanel = activeConv ? (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", animation: isDesktop ? undefined : "fadeIn 0.2s ease" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.b1}`, background: C.w, display: "flex", alignItems: "center", gap: 10, paddingTop: isDesktop ? 12 : "max(12px, env(safe-area-inset-top))" }}>
          {!isDesktop && <button onClick={() => { setActiveConv(null); setChatTab("chat"); }} style={{ background: C.priPale, border: `1px solid ${C.pri}20`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", fontFamily:"inherit", fontSize:11, fontWeight:600, color:C.pri }}>{Ic.chev(C.pri, 16)} Chats</button>}
          {isDesktop && <button onClick={() => { setActiveConv(null); setChatTab("chat"); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>{Ic.chev(C.pri, 20)}</button>}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{activeConv.freight ? freightTitle(activeConv.freight) : "Mensaje directo"}</div>
            <div style={{ fontSize: 10, color: C.t3 }}>{getConvName(activeConv)} · {messages.length} mensaje{messages.length !== 1 ? "s" : ""}</div>
          </div>
          {/* Chat / Files tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setChatTab("chat")} style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: chatTab === "chat" ? C.priPale : "none", color: chatTab === "chat" ? C.pri : C.t3, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Chat</button>
            <button onClick={() => setChatTab("files")} style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: chatTab === "files" ? C.priPale : "none", color: chatTab === "files" ? C.pri : C.t3, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", position: "relative" }}>
              Archivos
              {chatFiles.length > 0 && <span style={{ position: "absolute", top: -2, right: -2, minWidth: 14, height: 14, borderRadius: 7, background: C.acc, color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{chatFiles.length}</span>}
            </button>
          </div>
        </div>

        {chatTab === "chat" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            {sendError && (
              <div style={{ padding: "10px 18px", background: C.errPale, borderBottom: `1px solid ${C.err}40`, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: C.err, fontWeight: 600 }}>{sendError}</span>
              </div>
            )}
            <div ref={messagesContainerRef} onScroll={handleScroll} style={{ flex: 1, overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {msgHasMore && (
                <div style={{textAlign:"center",padding:"8px 0 12px"}}>
                  <button onClick={loadOlderMessages} disabled={loadingOlder} style={{padding:"5px 16px",borderRadius:8,border:`1px solid ${C.b1}`,background:C.bg,color:C.t2,fontSize:11,fontWeight:600,cursor:loadingOlder?"default":"pointer",fontFamily:"inherit",opacity:loadingOlder?0.5:1}}>
                    {loadingOlder?"Cargando...":"Cargar mensajes anteriores"}
                  </button>
                </div>
              )}
              {messages.length === 0 && !loadingOlder && <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Sin mensajes aún. Escribí el primero.</div>}
              {messages.map((m, idx) => {
                // Issue #25 fix: explicit null safety on senderId
                const mine = !!(m.senderId && m.senderId === user.id) || !!(m.sender?.id && m.sender.id === user.id);
                const fileData = parseFileMsg(m.text);
                const prevMsg = messages[idx - 1];
                const showDateDivider = !prevMsg || new Date(m.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

                return (
                  <div key={m.id}>
                    {/* Date divider */}
                    {showDateDivider && (
                      <div style={{ textAlign: "center", margin: "12px 0", position: "relative" }}>
                        <div style={{ display: "inline-block", padding: "4px 12px", background: C.bg, borderRadius: 12, fontSize: 10, fontWeight: 600, color: C.t3, border: `1px solid ${C.b1}` }}>
                          {formatDateDivider(m.createdAt)}
                        </div>
                      </div>
                    )}

                    <div style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                      {!mine && <div style={{ fontSize: 9.5, color: C.t3, marginBottom: 2, marginLeft: 4 }}>{m.sender?.name?.split(" ")[0]}</div>}
                      <div style={{ position: "relative", padding: fileData ? "6px" : "10px 14px", borderRadius: 14, borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4, background: mine ? C.pri : C.w, color: mine ? C.w : C.t1, fontSize: 13, border: mine ? "none" : `1px solid ${C.b1}`, boxShadow: C.sh, overflow: "hidden", opacity: m.status === 'pending' ? 0.6 : 1 }}>
                        {fileData ? (
                          fileData.type === "image" && fileData.url ? (
                            <button onClick={()=>setViewFile({url:fileData.url,name:fileData.name,type:"image"})} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                              <img src={fileData.url} alt={fileData.name} loading="lazy" style={{ maxWidth: 220, maxHeight: 200, borderRadius: 10, display: "block" }} />
                            </button>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button onClick={()=>{ if(fileData.url) setViewFile({url:fileData.url,name:fileData.name}); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", color: mine ? "#fff" : C.t1, flex: 1 }}>
                                {Ic.doc(mine ? "#fff" : C.pri, 20)}
                                <div style={{ textAlign:"left" }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, wordBreak: "break-all" }}>{fileData.name}</div>
                                  <div style={{ fontSize: 10, opacity: 0.7 }}>{fileData.url ? "Ver archivo" : "Archivo no disponible"}</div>
                                </div>
                              </button>
                              {fileData.url && <a href={fileData.url} download={fileData.name} style={{ background: mine ? "rgba(255,255,255,0.2)" : C.priPale, border: "none", borderRadius: 6, padding: 6, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }} title="Descargar">
                                {Ic.download(mine ? "#fff" : C.pri, 16)}
                              </a>}
                            </div>
                          )
                        ) : (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <div style={{ flex: 1 }}>{renderTextWithMentions(m.text, mine)}</div>
                            {!fileData && (
                              <button onClick={() => copyMessageText(m.text, m.id)} title="Copiar" style={{ background: mine ? "rgba(255,255,255,0.2)" : C.bg, border: "none", borderRadius: 4, padding: "2px 4px", cursor: "pointer", fontSize: 9, color: mine ? "#fff" : C.t2, opacity: copiedMsgId === m.id ? 1 : 0.5, transition: "opacity 0.2s" }}>
                              {copiedMsgId === m.id ? "✓" : "⎘"}
                            </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: C.t3, marginTop: 2, textAlign: mine ? "right" : "left", marginRight: mine ? 4 : 0, marginLeft: mine ? 0 : 4, display: "flex", alignItems: "center", gap: 4, justifyContent: mine ? "flex-end" : "flex-start" }}>
                        <span title={new Date(m.createdAt).toLocaleString("es")}>
                          {new Date(m.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {mine && m.status === 'pending' && <span style={{ fontSize: 9, opacity: 0.5 }}>⏱</span>}
                        {mine && m.status === 'failed' && (
                          <button onClick={() => retryFailedMessage(m)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2, padding: 0, color: C.err, fontSize: 9, fontWeight: 600 }}>
                            ❌ Reintentar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Read receipt: double check on last own message */}
              {peerReadAt && messages.length > 0 && (() => {
                const lastOwn = [...messages].reverse().find(m => m.senderId === user.id || m.sender?.id === user.id);
                return lastOwn ? <div style={{ textAlign:"right", fontSize:9.5, color:C.pri, fontWeight:600, marginRight:4, marginTop:-2 }}>✓✓ Leído</div> : null;
              })()}
              {/* Typing indicator */}
              {typingUser && <div style={{ alignSelf:"flex-start", padding:"8px 14px", borderRadius:14, background:C.w, border:`1px solid ${C.b1}`, fontSize:12, color:C.t3, fontStyle:"italic", animation:"fadeIn 0.2s ease" }}>{typingUser} está escribiendo...</div>}
              <div ref={msgEndRef} />
            </div>

            {/* Upload progress */}
            {uploading && (
              <div style={{ padding: "8px 18px", background: C.accPale, borderTop: `1px solid ${C.acc}20`, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 16, height: 16, border: `2px solid ${C.acc}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 11, color: C.acc, fontWeight: 600 }}>Subiendo archivo...</span>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            {/* Nuevo mensaje indicator - floating button */}
            {newMsgIndicator && (
              <div style={{ position: "absolute", bottom: keyboardHeight > 0 ? keyboardHeight + 70 : 70, left: "50%", transform: "translateX(-50%)", zIndex: 10, animation: "fadeIn 0.2s ease" }}>
                <button onClick={scrollToBottom} style={{ padding: "8px 16px", borderRadius: 20, background: C.pri, color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontFamily: "inherit", transition: "all 0.2s ease" }}>
                  Nuevo mensaje {Ic.down("#fff", 14)}
                </button>
              </div>
            )}

            <div style={{ padding: "10px 18px", paddingBottom: keyboardHeight > 0 ? `${Math.max(10, keyboardHeight - 60)}px` : "max(10px, env(safe-area-inset-bottom))", borderTop: `1px solid ${C.b1}`, background: C.w, display: "flex", gap: 8, alignItems: "center", transition: "padding-bottom 0.2s ease" }}>
              <input ref={chatCamRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: "none" }} />
              <input ref={chatGalRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} style={{ display: "none" }} />
              <input ref={chatFileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
              <button onClick={() => setShowChatAttach(true)} disabled={uploading} style={{ width: 40, height: 40, borderRadius: 20, background: C.bg, border: `1px solid ${C.b1}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {Ic.clip(C.t2, 18)}
              </button>
              <AttachMenu open={showChatAttach} onClose={() => setShowChatAttach(false)} onCamera={() => chatCamRef.current?.click()} onGallery={() => chatGalRef.current?.click()} onFiles={() => chatFileRef.current?.click()} />
              <input ref={inputRef} value={msgText} onChange={e => { setMsgText(e.target.value); sendTyping(); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Escribí un mensaje..." style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1.5px solid ${C.b1}`, background: C.bg, color: C.t1, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              <button onClick={handleSend} disabled={sending || !msgText.trim()} style={{ width: 40, height: 40, borderRadius: 20, background: msgText.trim() ? C.pri : C.b1, border: "none", cursor: msgText.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {Ic.send(C.w, 16)}
              </button>
            </div>
          </div>
        ) : (
          /* Files tab */
          <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
            {chatFiles.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Sin archivos compartidos</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {chatFiles.map(f => (
                  <button key={f.id} onClick={()=>setViewFile({url:f.url,name:f.name,type:f.type})} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: C.w, border: `1px solid ${C.b1}`, borderRadius: 10, cursor:"pointer", fontFamily:"inherit", textAlign:"left", boxShadow: C.sh, width:"100%" }}>
                    {f.type === "image" ? (
                      <img src={thumb(f.url)} alt="" loading="lazy" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: C.priPale, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{Ic.doc(C.pri, 22)}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, wordBreak: "break-all" }}>{f.name}</div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{f.sender} · {new Date(f.date).toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    {Ic.eye(C.pri, 16)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    ) : isDesktop ? (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.t3, fontSize: 13 }}>Seleccioná una conversación</div>
    ) : null;

  // Mobile: show detail fullscreen if activeConv
  if (!isDesktop && activeConv) {
    return chatDetailPanel;
  }

  // Desktop: split layout / Mobile: list only
  const chatListPanel = (
    <div style={{ flex: isDesktop ? undefined : 1, overflow: "auto", padding: isDesktop ? "18px 14px" : 18, width: isDesktop ? 320 : undefined, minWidth: isDesktop ? 320 : undefined, borderRight: isDesktop ? `1px solid ${C.b2}` : undefined, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isDesktop ? 10 : 14 }}>
        <Btn sm onClick={() => setShowNew(!showNew)} icon={showNew ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showNew ? "Cerrar" : "Nuevo"}</Btn>
      </div>

      {/* Search bar */}
      <div style={{ position:"relative", marginBottom:8 }}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,16)}</div>
        <input value={searchQ} onChange={e=>{setSearchQ(e.target.value);}} placeholder="Buscar conversación..."
          style={{width:"100%",padding:"10px 14px 10px 36px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        {searchQ && <button onClick={()=>setSearchQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,16)}</button>}
      </div>

      {/* Group by selector */}
      <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:10, fontWeight:600, color:C.t3 }}>Agrupar por</span>
        {[{k:"planta",l:"Planta"},{k:"transportista",l:"Transportista"},{k:"productor",l:"Productor"}].map(o=>(
          <button key={o.k} onClick={()=>{setGroupBy(o.k);setExpandedGroups({});}} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${groupBy===o.k?C.pri:C.b1}`, background:groupBy===o.k?C.priPale:C.w, color:groupBy===o.k?C.pri:C.t2, fontSize:10, fontWeight:groupBy===o.k?700:500, cursor:"pointer", fontFamily:"inherit" }}>{o.l}</button>
        ))}
      </div>

      {showNew && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: C.sh }}>
          <Field label="Buscar usuario" value={compSearchQ} onChange={handleCompSearch} placeholder="Escribí el nombre de la persona..."/>
          {compSearching && <div style={{ fontSize:10, color:C.t3, marginTop:4 }}>Buscando...</div>}
          {compResults.length > 0 && (
            <div style={{ marginTop:6, border:`1px solid ${C.b1}`, borderRadius:8, maxHeight:200, overflow:"auto" }}>
              {compResults.map(u=>(
                <button key={u.id} onClick={()=>handleSelectUser(u)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:newUserId===u.id?C.priPale:C.w, border:"none", borderBottom:`1px solid ${C.b2}`, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                  {Ic.user(C.pri,16)}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{u.name}</div>
                    <div style={{ fontSize:10, color:C.t3 }}>{u.company?.name || "Sin empresa"} · {({plant:"Planta",transporter:"Transportista",producer:"Productor"})[u.company?.type]||u.company?.type||""}</div>
                  </div>
                  {newUserId===u.id && Ic.chk(C.pri,14)}
                </button>
              ))}
            </div>
          )}
          {compSearchQ.length>=2 && !compSearching && compResults.length===0 && !newUserId && <div style={{ fontSize:11, color:C.t3, marginTop:6 }}>Sin resultados</div>}
          {newUserId && <div style={{ fontSize:11, color:C.ok, marginTop:6, fontWeight:600 }}>Usuario seleccionado: {compSearchQ}</div>}
          {newErr && <div style={{ fontSize: 11, color: C.err, marginTop:6, marginBottom: 4 }}>{newErr}</div>}
          <div style={{ marginTop:10 }}><Btn full v="acc" disabled={!newUserId||startingConv} onClick={handleStartConv}>{startingConv?"Iniciando...":"Iniciar conversación"}</Btn></div>
        </div>
      )}

      {loading ? <Loader/> :
        convs.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Sin conversaciones aún.{!showNew && <><br/><button onClick={()=>setShowNew(true)} style={{background:"none",border:"none",color:C.acc,fontWeight:600,cursor:"pointer",fontFamily:"inherit",fontSize:13,marginTop:8}}>Iniciar una nueva</button></>}</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Direct conversations (flat, no nesting) */}
            {grouped.directConvs.map(c => (
              <div key={c.id} style={{ position: "relative", width:"100%", border:`1px solid ${c.unread||c.markedUnread?C.acc+"40":C.b1}`, borderRadius:12, background:c.unread||c.markedUnread?C.accPale+"30":C.w, transition:"all 0.15s", boxShadow:C.sh, overflow: "hidden" }}>
                <button onClick={() => openConv(c)} style={{ width:"100%", padding:"12px 14px", background: "transparent", border: "none", cursor:"pointer", fontFamily:"inherit", textAlign:"left", display:"flex", alignItems:"center", gap:12 }} onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{ width:36, height:36, borderRadius:18, background:c.unread||c.markedUnread?C.acc:C.accPale, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {Ic.user(c.unread||c.markedUnread?"#fff":C.acc, 16)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:13, fontWeight:c.unread||c.markedUnread?800:700, color:C.t1 }}>{c._userName}</span>
                    </div>
                    {c._companyName && <div style={{ fontSize:10, color:C.t3, marginTop:1 }}>{c._companyName}</div>}
                    <div style={{ fontSize:11, color:c.unread||c.markedUnread?C.t1:C.t3, fontWeight:c.unread||c.markedUnread?600:400, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginTop:2 }}>{getLastMsg(c)}</div>
                  </div>
                  {(c.unread || c.markedUnread) && <div style={{ width:8, height:8, borderRadius:4, background:C.acc, flexShrink:0 }} />}
                  <span style={{ fontSize:9.5, color:C.t3, flexShrink:0 }}>{getLastMsgTime(c)}</span>
                </button>
                {/* Action buttons */}
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                  <button onClick={(e) => handleToggleMarkUnread(c.id, e)} title={c.markedUnread ? "Marcar como leída" : "Marcar como no leída"} style={{ background: c.markedUnread ? C.accPale : C.bg, border: `1px solid ${c.markedUnread ? C.acc : C.b1}`, borderRadius: 6, padding: "4px 6px", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", opacity: 0.8 }}>
                    {c.markedUnread ? "✉️" : "📧"}
                  </button>
                </div>
              </div>
            ))}

            {/* Freight conversations grouped by company */}
            {grouped.companyKeys.map(companyName => {
              const group = grouped.byCompany[companyName];
              const isOpen = expandedGroups[companyName] !== false;
              const freightCount = group.freightConvs.length;
              const unreadCount = group.freightConvs.filter(c=>c.unread).length;
              return (
                <div key={companyName} style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, overflow: "hidden", boxShadow: C.sh }}>
                  <button onClick={() => toggleGroup(companyName)} style={{ width: "100%", padding: "12px 14px", background: C.w, border: "none", borderBottom: isOpen ? `1px solid ${C.b2}` : "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: C.priPale, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {Ic.truck(C.pri, 16)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{companyName}</div>
                      <div style={{ fontSize: 10.5, color: C.t3 }}>{freightCount} flete{freightCount !== 1 ? "s" : ""}</div>
                    </div>
                    {unreadCount > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: C.acc, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", flexShrink: 0 }}>{unreadCount}</span>}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.5" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>

                  {isOpen && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {group.freightConvs.map(c => (
                        <button key={c.id} onClick={() => openConv(c)} style={{ padding: "10px 14px", border: "none", borderTop: `1px solid ${C.b2}`, background: c.unread ? C.accPale+"30" : C.w, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 10, width: "100%", transition: "background 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background=c.unread?C.accPale+"30":C.w}>
                          <div style={{ width: 8, height: 8, borderRadius: 4, background: stColor(c.freight?.status), flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: c.unread ? 800 : 700, color: C.t1 }}>{freightTitle(c.freight)}</span>
                              <span style={{ fontSize: 9, fontWeight: 600, color: stColor(c.freight?.status), textTransform: "uppercase" }}>{stLabel(c.freight?.status)}</span>
                            </div>
                            <div style={{ fontSize: 11, color: c.unread ? C.t1 : C.t3, fontWeight: c.unread ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{getLastMsg(c)}</div>
                          </div>
                          {c.unread && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.acc, flexShrink: 0 }} />}
                          <span style={{ fontSize: 9.5, color: C.t3, flexShrink: 0 }}>{getLastMsgTime(c)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      }
    </div>
  );

  if (isDesktop) {
    return (
      <>
        <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" }}>
          {chatListPanel}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {chatDetailPanel}
          </div>
        </div>
        <FileViewer file={viewFile} onClose={()=>setViewFile(null)}/>
      </>
    );
  }

  return (
    <>
      {chatListPanel}
      <FileViewer file={viewFile} onClose={()=>setViewFile(null)}/>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
