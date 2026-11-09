"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase/client";

type Msg = { role: "user" | "assistant"; content: string; image?: string; attachment?: string; sources?: {title:string;url:string}[]; images?: {title:string;url:string;pageUrl?:string;artist?:string;license?:string}[] };
type Chat = { id: string; title: string; messages: Msg[] };

const KEY = "4hab-chats";
const uid = () => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [cur, setCur] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [imgMode, setImgMode] = useState(false);
  const [menu, setMenu] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("متوقف");
  const recognitionRef = useRef<any>(null);
  const voiceModeRef = useRef(false);
  const voiceBusyRef = useRef(false);
  const skipLocalSaveOnceRef = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudReadyUserId, setCloudReadyUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authBusy, setAuthBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [displayName, setDisplayName] = useState("ضيف 4hab");
  const [nameDraft, setNameDraft] = useState("");
  const [panel, setPanel] = useState<"profile" | "settings" | null>(null);
  const [lightTheme, setLightTheme] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [compactMode, setCompactMode] = useState(false);
  const [enterToSend, setEnterToSend] = useState(true);
  const [fontScale, setFontScale] = useState("normal");
  const avatarFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s?.chats?.length) {
        setChats(s.chats);
        setCur(s.cur || s.chats[0].id);
      } else {
        const c: Chat = { id: uid(), title: "محادثة جديدة", messages: [] };
        setChats([c]);
        setCur(c.id);
      }
    } catch {
      const c: Chat = { id: uid(), title: "محادثة جديدة", messages: [] };
      setChats([c]);
      setCur(c.id);
    }
    try {
      const savedName = localStorage.getItem("4hab-profile-name");
      if (savedName) setDisplayName(savedName);
      const savedTheme = localStorage.getItem("4hab-theme");
      if (savedTheme === "light") setLightTheme(true);
      const savedAvatar = localStorage.getItem("4hab-avatar");
      if (savedAvatar) setAvatarUrl(savedAvatar);
      setCompactMode(localStorage.getItem("4hab-compact") === "true");
      setEnterToSend(localStorage.getItem("4hab-enter-send") !== "false");
      setFontScale(localStorage.getItem("4hab-font-scale") || "normal");
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && authReady && !user) {
      if (skipLocalSaveOnceRef.current) {
        skipLocalSaveOnceRef.current = false;
        return;
      }
      try { localStorage.setItem(KEY, JSON.stringify({ chats, cur })); } catch {}
    }
  }, [chats, cur, ready, authReady, user]);

  useEffect(() => {
    let active = true;
    const currentUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
    const recoveryRedirect =
      currentUrl.searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery";
    if (recoveryRedirect) setRecoveryMode(true);
    let client: ReturnType<typeof getSupabase>;
    try {
      client = getSupabase();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "إعدادات Supabase غير مكتملة.");
      setAuthReady(true);
      return;
    }
    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      setUser(data.session?.user ?? null);
      if (recoveryRedirect && data.session) setRecoveryMode(true);
      setAuthReady(true);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (!session?.user) skipLocalSaveOnceRef.current = true;
      setUser(session?.user ?? null);
      setAuthReady(true);
      setAuthError("");
      if (session?.user) setAuthOpen(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCloudReadyUserId(null);
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "null");
        if (saved?.chats?.length) {
          setChats(saved.chats);
          setCur(saved.cur || saved.chats[0].id);
        }
      } catch {}
      return;
    }
    let cancelled = false;
    setCloudReadyUserId(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from("chats")
          .select("id, title, messages")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        if (cancelled) return;
        if (data?.length) {
          const remoteChats: Chat[] = data.map((row: any) => ({
            id: row.id,
            title: row.title || "محادثة جديدة",
            messages: Array.isArray(row.messages) ? row.messages : [],
          }));
          setChats(remoteChats);
          setCur(remoteChats[0].id);
        } else {
          const first: Chat = { id: uid(), title: "محادثة جديدة", messages: [] };
          setChats([first]);
          setCur(first.id);
        }
        setSyncError("");
        setCloudReadyUserId(user.id);
      } catch (error) {
        if (!cancelled) setSyncError(error instanceof Error ? error.message : "تعذر تحميل المحادثات.");
      }
    })();
    return () => { cancelled = true; };
  }, [user, authReady]);

  useEffect(() => {
    if (!user || cloudReadyUserId !== user.id || !chats.length) return;
    const timeout = window.setTimeout(async () => {
      const rows = chats.map((item) => ({
        id: item.id,
        user_id: user.id,
        title: item.title,
        messages: item.messages,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await getSupabase().from("chats").upsert(rows, { onConflict: "id" });
      if (error) setSyncError(error.message);
      else setSyncError("");
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [chats, user, cloudReadyUserId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, cur, busy]);

  async function handleAuth() {
    setAuthError("");
    if (!email.trim() || !password) {
      setAuthError("اكتب البريد الإلكتروني وكلمة المرور أولًا.");
      return;
    }
    setAuthBusy(true);
    try {
      const client = getSupabase();
      if (authMode === "signup") {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          setAuthError("تم إنشاء الحساب. افتح بريدك الإلكتروني واضغط رابط التأكيد، ثم سجّل الدخول.");
        } else {
          setAuthError("");
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "تعذر تسجيل الدخول.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordReset() {
    setAuthError("");
    if (!email.trim()) {
      setAuthError("اكتب بريدك الإلكتروني أولًا، وسنرسل لك رابط تغيير كلمة المرور.");
      return;
    }
    setAuthBusy(true);
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://4hab-ai.vercel.app",
      });
      if (error) throw error;
      setAuthError("إذا كان البريد مسجلًا، ستصلك رسالة فيها رابط إعادة تعيين كلمة المرور. افحص صندوق الوارد والرسائل غير المرغوب فيها.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "تعذر إرسال رابط استعادة كلمة المرور.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleUpdatePassword() {
    setAuthError("");
    if (newPassword.length < 6) {
      setAuthError("كلمة المرور الجديدة لازم تكون 6 أحرف على الأقل.");
      return;
    }
    setAuthBusy(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setRecoveryMode(false);
      setAuthError("تم تغيير كلمة المرور بنجاح. تقدر تستخدمها لتسجيل الدخول.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "تعذر تغيير كلمة المرور.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setAuthError("");
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
      setCloudReadyUserId(null);
      setSyncError("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "تعذر تسجيل الخروج.");
    }
  }

  function saveProfile() {
    const cleanName = nameDraft.trim().slice(0, 32);
    if (!cleanName) return;
    setDisplayName(cleanName);
    try { localStorage.setItem("4hab-profile-name", cleanName); } catch {}
    setPanel(null);
  }

  function saveAvatar(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("اختر ملف صورة فقط."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("حجم الصورة يجب أن يكون أقل من 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setAvatarUrl(value);
      try { localStorage.setItem("4hab-avatar", value); } catch { alert("الصورة كبيرة على مساحة التخزين المحلية."); }
    };
    reader.readAsDataURL(file);
  }

  function savePreference(key: string, value: string | boolean) {
    try { localStorage.setItem(key, String(value)); } catch {}
  }

  function changeTheme(next: boolean) {
    setLightTheme(next);
    try { localStorage.setItem("4hab-theme", next ? "light" : "dark"); } catch {}
  }

  function newChat() {
    const c: Chat = { id: uid(), title: "محادثة جديدة", messages: [] };
    setChats((p) => [c, ...p]);
    setCur(c.id);
    setMenu(false);
    setImgMode(false);
  }

  function delChat(id: string) {
    if (user && cloudReadyUserId === user.id) {
      getSupabase().from("chats").delete().eq("id", id).eq("user_id", user.id)
        .then(({ error }) => { if (error) setSyncError(error.message); });
    }
    const rest = chats.filter((c) => c.id !== id);
    if (!rest.length) {
      const c: Chat = { id: uid(), title: "محادثة جديدة", messages: [] };
      setChats([c]);
      setCur(c.id);
      return;
    }
    setChats(rest);
    if (id === cur) setCur(rest[0].id);
  }

  function update(id: string, fn: (c: Chat) => Chat) {
    setChats((p) => p.map((c) => (c.id === id ? fn(c) : c)));
  }

  const chat = chats.find((c) => c.id === cur);

  function renderLinkedText(value: string) {
    const parts = value.split(/(https?:\/\/[^\s<]+)/g);
    return parts.map((part, index) => {
      if (/^https?:\/\//i.test(part)) {
        const clean = part.replace(/[),.!؟،؛]+$/g, "");
        const tail = part.slice(clean.length);
        return <span key={index}><a href={clean} target="_blank" rel="noreferrer">{clean}</a>{tail}</span>;
      }
      return <span key={index}>{part}</span>;
    });
  }

  async function copyMessage(value: string) {
    try { await navigator.clipboard.writeText(value); setActiveMessageMenu(null); }
    catch { alert("تعذر النسخ. اسمح للمتصفح باستخدام الحافظة."); }
  }

  async function shareMessage(value: string) {
    try {
      if (navigator.share) await navigator.share({ text: value });
      else { await navigator.clipboard.writeText(value); alert("تم نسخ الرسالة؛ يمكنك لصقها ومشاركتها."); }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) alert("تعذرت مشاركة الرسالة من هذا المتصفح.");
    }
    setActiveMessageMenu(null);
  }

  function speakMessage(value: string) {
    if (!("speechSynthesis" in window)) { alert("ميزة قراءة النص غير مدعومة في هذا المتصفح."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = "ar-EG";
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
    setActiveMessageMenu(null);
  }

  function stopVoiceChat() {
    voiceModeRef.current = false;
    setVoiceMode(false);
    setListening(false);
    setVoiceStatus("متوقف");
    recognitionRef.current?.stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function startVoiceRecognition() {
    if (!voiceModeRef.current || voiceBusyRef.current) return;
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setVoiceStatus("المتصفح لا يدعم المحادثة الصوتية");
      stopVoiceChat();
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "ar-EG";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => { setListening(true); setVoiceStatus("أسمعك…"); };
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results || []).map((result: any) => result?.[0]?.transcript || "").join(" ").trim();
      if (transcript) { recognition.stop(); void sendVoiceTurn(transcript); }
    };
    recognition.onerror = (event: any) => {
      setListening(false);
      if (voiceModeRef.current && event?.error !== "no-speech" && event?.error !== "aborted") setVoiceStatus("تأكد من السماح باستخدام الميكروفون");
    };
    recognition.onend = () => {
      setListening(false);
      if (voiceModeRef.current && !voiceBusyRef.current && !window.speechSynthesis?.speaking) window.setTimeout(() => startVoiceRecognition(), 350);
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setListening(false); setVoiceStatus("تعذر تشغيل الميكروفون"); }
  }

  async function sendVoiceTurn(transcript: string) {
    if (voiceBusyRef.current || !transcript.trim()) return;
    const activeChat = chats.find((item) => item.id === cur);
    if (!activeChat) return;
    voiceBusyRef.current = true;
    setBusy(true);
    setVoiceStatus("أفكر…");
    const userMsg: Msg = { role: "user", content: transcript.trim() };
    update(activeChat.id, (item) => ({ ...item, title: item.messages.length ? item.title : transcript.trim().slice(0, 30), messages: [...item.messages, userMsg] }));
    try {
      const history = [...activeChat.messages, userMsg].filter((message) => !message.image && message.content).map((message) => ({ role: message.role, content: message.content }));
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "حصل خطأ أثناء الاتصال.");
      const answer = data.text || data.reply || "تعذر الرد.";
      update(activeChat.id, (item) => ({ ...item, messages: [...item.messages, { role: "assistant", content: answer, sources: data.sources || [] }] }));
      if (!voiceModeRef.current) { voiceBusyRef.current = false; setBusy(false); return; }
      setVoiceStatus("أتكلم…");
      const utterance = new SpeechSynthesisUtterance(answer);
      utterance.lang = "ar-EG";
      utterance.rate = 1;
      const resume = () => { voiceBusyRef.current = false; setBusy(false); if (voiceModeRef.current) startVoiceRecognition(); };
      utterance.onend = resume;
      utterance.onerror = resume;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
      update(activeChat.id, (item) => ({ ...item, messages: [...item.messages, { role: "assistant", content: message }] }));
      voiceBusyRef.current = false;
      setBusy(false);
      if (voiceModeRef.current) startVoiceRecognition();
    }
  }

  function toggleVoiceInput() {
    if (voiceModeRef.current) { stopVoiceChat(); return; }
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI || !("speechSynthesis" in window)) { alert("المحادثة الصوتية تحتاج Chrome أو Edge يدعم الميكروفون وقراءة الصوت."); return; }
    voiceModeRef.current = true;
    setVoiceMode(true);
    setVoiceStatus("جاري تشغيل الميكروفون…");
    startVoiceRecognition();
  }

  async function send() {
    const text = input.trim();
    if ((!text && !attachment) || busy || !chat) return;
    const id = chat.id;
    const currentMessages = chat.messages;
    setInput("");
    setBusy(true);
    const imageData = attachment;
    setAttachment(null);
    setAttachmentName("");

    const userMsg: Msg = { role: "user", content: text || "ما هذه الصورة؟", attachment: imageData || undefined };
    update(id, (c) => ({
      ...c,
      title: c.messages.length ? c.title : text.slice(0, 30),
      messages: [...c.messages, userMsg],
    }));

    try {
      const normalizedText = text.trim();
      const imageWords = ["صور", "صوره", "صورة", "صورلي", "صوري", "وريني", "هات", "ابعتلي", "ابعت", "اعرضلي"];
      const imageIntent = imageWords.some((word) => normalizedText.includes(word));
      const isSalahNameOnly = normalizedText === "محمد صلاح";
      const wantsRealImages = imageIntent || isSalahNameOnly;
      let imageQuery = normalizedText;
      for (const word of imageWords) {
        if (imageQuery.startsWith(word)) {
          imageQuery = imageQuery.slice(word.length).trim();
          break;
        }
      }
      if (!imageQuery) imageQuery = normalizedText;
      if (wantsRealImages && !imageData) {
        const r = await fetch(`/api/search-images?q=${encodeURIComponent(imageQuery)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "تعذر البحث عن الصور.");
        update(id, (c) => ({
          ...c,
          messages: [...c.messages, {
            role: "assistant",
            content: d.images?.length ? `دي صور حقيقية لـ ${imageQuery} من ويكيميديا كومنز:` : `ملقيتش صور مناسبة لـ ${imageQuery} في مصدر الصور المتاح.`,
            images: d.images || [],
          }],
        }));
      } else if (imgMode) {
        const r = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "تعذر إنشاء الصورة.");
        const imageUrl = d.imageUrl || d.url;
        if (!imageUrl) throw new Error("خدمة الصور لم تُرجع رابطًا للصورة.");
        update(id, (c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: "تفضل، هذه الصورة التي طلبتها:", image: imageUrl }],
        }));
      } else {
        const history = [...currentMessages, userMsg]
          .filter((m) => !m.image && m.content)
          .map((m) => ({ role: m.role, content: m.content, ...(m.attachment ? { image: m.attachment } : {}) }));
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "حصل خطأ أثناء الاتصال.");
        update(id, (c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: d.text || d.reply || "تعذر الرد.", sources: d.sources || [] }],
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
      update(id, (c) => ({
        ...c,
        messages: [...c.messages, { role: "assistant", content: message }],
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={"app" + (lightTheme ? " light" : "") + (compactMode ? " compact" : "") + (fontScale !== "normal" ? " font-" + fontScale : "")} dir="rtl">
      <style>{css}</style>
      <aside className={"side" + (menu ? " open" : "")}>
        <div className="logo">4hab AI ✦</div>
        <button className="new" onClick={newChat}>＋ محادثة جديدة</button>
        <div className="list">
          {chats.map((c) => (
            <div key={c.id} className={"item" + (c.id === cur ? " on" : "")} onClick={() => { setCur(c.id); setMenu(false); }}>
              <span>{c.title}</span>
              <button onClick={(e) => { e.stopPropagation(); delChat(c.id); }} aria-label="حذف">🗑</button>
            </div>
          ))}
        </div>
        <div className="side-bottom">
          <input ref={avatarFileRef} type="file" accept="image/*" hidden onChange={(e) => { saveAvatar(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          <button className="side-account" onClick={() => setAccountMenu(!accountMenu)}>
            {avatarUrl ? <img className="account-avatar" src={avatarUrl} alt="صورة الحساب" /> : <span className="account-avatar">{(displayName || "ض").slice(0,1)}</span>}
            <span className="account-copy"><strong>{displayName}</strong><small>{user?.email || "حساب ضيف"}</small></span>
            <span className="account-more">⋯</span>
          </button>
          {accountMenu && <div className="account-menu">
            {user ? <>
              <button onClick={() => { setNameDraft(displayName); setPanel("profile"); setAccountMenu(false); }}>الملف الشخصي</button>
              <button onClick={() => { setPanel("settings"); setAccountMenu(false); }}>الإعدادات</button>
              <button className="logout-item" onClick={() => { setAccountMenu(false); void handleSignOut(); }}>تسجيل الخروج</button>
            </> : <>
              <button onClick={() => { setAuthMode("signin"); setAuthError(""); setAuthOpen(true); setAccountMenu(false); }}>تسجيل الدخول</button>
              <button onClick={() => { setAuthMode("signup"); setAuthError(""); setAuthOpen(true); setAccountMenu(false); }}>إنشاء حساب</button>
              <button onClick={() => { setPanel("profile"); setAccountMenu(false); }}>الملف الشخصي</button>
              <button onClick={() => { setPanel("settings"); setAccountMenu(false); }}>الإعدادات</button>
            </>}
          </div>}
        </div>
      </aside>
      {authOpen && <div className="panel-shade" onClick={() => setAuthOpen(false)}>
        <section className="settings-panel auth-modal" onClick={(e) => e.stopPropagation()}>
          <div className="panel-heading"><strong>{authMode === "signin" ? "تسجيل الدخول إلى 4hab AI" : "إنشاء حساب جديد"}</strong><button onClick={() => setAuthOpen(false)}>×</button></div>
          <input className="panel-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" autoComplete="email" />
          <input className="panel-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" autoComplete={authMode === "signin" ? "current-password" : "new-password"} />
          <button className="panel-primary" onClick={handleAuth} disabled={authBusy || !authReady}>{authBusy ? "انتظر..." : authMode === "signin" ? "دخول" : "إنشاء الحساب"}</button>
          <button className="auth-switch" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); }}>{authMode === "signin" ? "ليس لديك حساب؟ أنشئ حسابًا" : "لديك حساب؟ سجّل الدخول"}</button>
          {authMode === "signin" && <button className="auth-switch" onClick={handlePasswordReset} disabled={authBusy}>نسيت كلمة المرور؟</button>}
          {authError && <div className="auth-error">{authError}</div>}
        </section>
      </div>}
      {panel && <div className="panel-shade" onClick={() => setPanel(null)}>
        <section className="settings-panel" onClick={(e) => e.stopPropagation()}>
          <div className="panel-heading"><strong>{panel === "profile" ? "الملف الشخصي" : "الإعدادات"}</strong><button onClick={() => setPanel(null)}>×</button></div>
          {panel === "profile" ? <>
            <div className="profile-big-avatar">{avatarUrl ? <img src={avatarUrl} alt="صورة الملف الشخصي" /> : (displayName || "ض").slice(0,1)}</div>
            <button className="panel-secondary" onClick={() => avatarFileRef.current?.click()}>تغيير صورة الحساب</button>
            {avatarUrl && <button className="auth-switch" onClick={() => { setAvatarUrl(""); try { localStorage.removeItem("4hab-avatar"); } catch {} }}>إزالة الصورة</button>}
            <label className="panel-label">اسم العرض</label>
            <input className="panel-input" value={nameDraft} maxLength={32} onChange={(e) => setNameDraft(e.target.value)} placeholder="اكتب اسمك" />
            <div className="panel-muted">{user?.email || "أنت تستخدم 4hab AI كضيف حاليًا."}</div>
            <button className="panel-primary" onClick={saveProfile}>حفظ الملف الشخصي</button>
          </> : <>
            <div className="settings-scroll">
              <h3 className="settings-section-title">المظهر والتخصيص</h3>
              <div className="setting-row"><div><strong>المظهر</strong><small>فاتح أو داكن</small></div><button className="theme-switch" onClick={() => changeTheme(!lightTheme)}>{lightTheme ? "فاتح ☀" : "داكن ☾"}</button></div>
              <div className="setting-row"><div><strong>كثافة المحادثات</strong><small>تقليل المسافات بين الرسائل</small></div><button className="theme-switch" onClick={() => { const v=!compactMode; setCompactMode(v); savePreference("4hab-compact",v); }}>{compactMode ? "مريحة" : "مضغوطة"}</button></div>
              <div className="setting-row"><div><strong>حجم الخط</strong><small>حجم النص داخل المحادثة</small></div><select className="settings-select" value={fontScale} onChange={(e) => { setFontScale(e.target.value); savePreference("4hab-font-scale",e.target.value); }}><option value="small">صغير</option><option value="normal">متوسط</option><option value="large">كبير</option></select></div>
              <h3 className="settings-section-title">المحادثة والكتابة</h3>
              <div className="setting-row"><div><strong>Enter للإرسال</strong><small>إرسال الرسالة بزر Enter</small></div><button className="theme-switch" onClick={() => { const v=!enterToSend; setEnterToSend(v); savePreference("4hab-enter-send",v); }}>{enterToSend ? "مفعّل" : "متوقف"}</button></div>
              <div className="setting-row"><div><strong>اللغة</strong><small>لغة واجهة الموقع</small></div><span className="setting-value">العربية</span></div>
              <h3 className="settings-section-title">الحساب والخصوصية</h3>
              <div className="setting-row"><div><strong>البريد الإلكتروني</strong><small>{user?.email || "حساب ضيف"}</small></div><span className="setting-value">{user ? "متصل" : "ضيف"}</span></div>
              <div className="setting-row"><div><strong>الملف الشخصي</strong><small>الاسم وصورة الحساب</small></div><button className="theme-switch" onClick={() => setPanel("profile")}>فتح</button></div>
              <div className="setting-row"><div><strong>تسجيل الخروج</strong><small>إنهاء جلسة الحساب</small></div><button className="theme-switch" onClick={handleSignOut} disabled={!user}>خروج</button></div>
            </div>
          </>}
        </section>
      </div>}
      {recoveryMode && <div className="panel-shade">
        <section className="settings-panel">
          <div className="panel-heading"><strong>تعيين كلمة مرور جديدة</strong></div>
          <p className="panel-muted">اكتب كلمة المرور الجديدة لحسابك.</p>
          <input className="panel-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="كلمة المرور الجديدة" autoComplete="new-password" />
          {authError && <div className="auth-error">{authError}</div>}
          <button className="panel-primary" style={{marginTop:14}} onClick={handleUpdatePassword} disabled={authBusy}>{authBusy ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}</button>
        </section>
      </div>}
      {menu && <div className="shade" onClick={() => setMenu(false)} />}
      <main className="main">
        <header className="top">
          <button className="burger" onClick={() => setMenu(true)} aria-label="فتح القائمة">☰</button>
          <span>{chat?.title || "4hab AI"}</span>
        </header>
        <div className="msgs">
          {chat && chat.messages.length === 0 && <div className="empty">كيف أقدر أساعدك اليوم؟</div>}
          {chat?.messages.map((m, i) => (
            <div key={i} className={"msg " + m.role}>
              {m.attachment && <img className="uploaded" src={m.attachment} alt="الصورة المرفقة" />}
              {m.images?.length ? (
                <div>
                  {m.content && <p>{m.content}</p>}
                  <div className="real-image-grid">{m.images.map((photo,j)=><div className="real-image-card" key={photo.url + j}>
                    <a href={photo.pageUrl || photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.title} loading="lazy" /></a>
                    <div className="real-image-caption">{photo.title}</div>
                    {photo.artist && <div className="real-image-credit">المصدر: {photo.artist}</div>}
                    {photo.license && <div className="real-image-credit">الرخصة: {photo.license}</div>}
                  </div>)}</div>
                </div>
              ) : m.image ? (
                <div>
                  {m.content && <p>{m.content}</p>}
                  <a href={m.image} target="_blank" rel="noreferrer">
                    <img src={m.image} alt="صورة تم إنشاؤها بواسطة 4hab AI" />
                  </a>
                </div>
              ) : <><div>{renderLinkedText(m.content)}</div>{m.sources?.length ? <div className="sources">{m.sources.map((s,j)=><a key={j} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div> : null}<div className="actions">
                <button onClick={() => copyMessage(m.content)} title="نسخ" aria-label="نسخ"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg></button>
                <button onClick={() => shareMessage(m.content)} title="مشاركة" aria-label="مشاركة"><svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                <button onClick={() => speakMessage(m.content)} title="استماع" aria-label="استماع"><svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6l-5 4H4zm12-1a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                <div className="message-more">
                  <button onClick={() => setActiveMessageMenu(activeMessageMenu === i ? null : i)} title="المزيد" aria-label="المزيد"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg></button>
                  {activeMessageMenu === i && <div className="more-menu">
                    <button onClick={() => copyMessage(m.content)}>نسخ الرسالة</button>
                    <button onClick={() => shareMessage(m.content)}>مشاركة الرسالة</button>
                    <button onClick={() => speakMessage(m.content)}>استمع للرسالة</button>
                  </div>}
                </div>
              </div></>}
            </div>
          ))}
          {busy && <div className="msg assistant">…</div>}
          <div ref={endRef} />
        </div>
        {voiceMode && <div style={{position:"absolute",bottom:82,left:0,right:0,display:"flex",justifyContent:"center",zIndex:5,pointerEvents:"none"}}><div style={{pointerEvents:"auto",background:"#222",border:"1px solid #444",borderRadius:24,padding:"9px 14px",display:"flex",alignItems:"center",gap:12,color:"#eee",fontSize:13}}><span>{voiceStatus}</span><button onClick={stopVoiceChat} style={{border:0,borderRadius:18,padding:"7px 12px",background:"#eee",color:"#111",cursor:"pointer"}}>إنهاء المكالمة</button></div></div>}
        <div className="bar">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f=e.target.files?.[0]; if(!f)return; if(f.size>8*1024*1024){alert("حجم الصورة يجب أن يكون أقل من 8MB");e.target.value="";return;} const reader=new FileReader(); reader.onload=()=>{setAttachment(String(reader.result));setAttachmentName(f.name);}; reader.readAsDataURL(f); e.target.value=""; }} />
          <div className="composer">
            <button className="inside-tool plus-tool" onClick={() => fileRef.current?.click()} title="إرفاق صورة" aria-label="إرفاق صورة">＋</button>
            <textarea
              rows={1}
              value={input}
              placeholder={imgMode ? "اوصف الصورة…" : "اسأل 4hab AI أي شيء…"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (enterToSend && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            {attachment && <div className="attachment-preview"><img src={attachment} alt="معاينة المرفق"/><span>{attachmentName}</span><button onClick={()=>{setAttachment(null);setAttachmentName("");}}>×</button></div>}
            <button className={"inside-tool mic-tool" + (voiceMode || listening ? " selected" : "")} onClick={toggleVoiceInput} title={voiceMode ? "إنهاء المكالمة الصوتية" : "بدء محادثة صوتية"} aria-label="محادثة صوتية"><svg viewBox="0 0 24 24"><rect x="9" y="2.5" width="6" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg></button>
            <button className="send" onClick={send} disabled={busy || (!input.trim() && !attachment)} aria-label="إرسال">↑</button>
          </div>
        </div>
      </main>
    </div>
  );
}

const css = `
*{box-sizing:border-box}

.account-menu{display:flex;flex-direction:column;gap:3px;padding:6px;margin:4px 0 0;background:#191919;border:1px solid #333;border-radius:12px}
.account-menu button{border:0;background:transparent;color:#eee;text-align:right;padding:10px;border-radius:8px;cursor:pointer;font:inherit;font-size:13px}
.account-menu button:hover{background:#303030}.account-menu .logout-item{color:#ff9b91}
.account-avatar{object-fit:cover}
.profile-big-avatar{overflow:hidden;width:76px;height:76px;margin:0 auto 14px;font-size:26px}
.profile-big-avatar img{width:100%;height:100%;object-fit:cover}
.auth-modal{display:flex;flex-direction:column;gap:12px}
.settings-scroll{max-height:min(65vh,620px);overflow:auto;padding-left:4px}
.settings-section-title{font-size:12px;color:#aaa;margin:18px 0 4px}
.settings-select{background:#292929;color:#eee;border:1px solid #484848;border-radius:8px;padding:7px}
.app.compact .msgs{gap:14px}.app.compact .msg{line-height:1.55}
.app.font-small .msg{font-size:13px}.app.font-large .msg{font-size:18px}

.auth-panel{padding:10px;margin:0 0 14px;border:1px solid #292929;border-radius:12px;background:#101010;display:flex;flex-direction:column;gap:8px}
.auth-status{font-size:13px;color:#eee;font-weight:600}
.auth-email{font-size:12px;color:#aaa;overflow-wrap:anywhere}
.auth-input{width:100%;border:1px solid #383838;background:#080808;color:#fff;border-radius:8px;padding:9px 10px;font:inherit;font-size:13px;outline:none}
.auth-input:focus{border-color:#777}
.auth-button{width:100%;border:0;border-radius:8px;background:#f2f2f2;color:#111;padding:9px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.auth-button:disabled{opacity:.5;cursor:not-allowed}
.auth-switch{border:0;background:transparent;color:#bbb;font:inherit;font-size:11px;cursor:pointer;padding:4px}
.auth-error{font-size:11px;line-height:1.6;color:#ffb4a9;overflow-wrap:anywhere}
html,body{margin:0;height:100%;background:#000;color:#ececec;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,sans-serif}
body{overflow:hidden}
button{font:inherit}
.app{display:flex;height:100dvh;background:#000}
.side{width:260px;flex-shrink:0;background:#080808;border-left:1px solid #242424;display:flex;flex-direction:column;padding:14px 12px}
.logo{font-weight:700;font-size:1.15rem;padding:9px 10px 18px;color:#f5f5f5;letter-spacing:.1px}
.new{background:transparent;color:#f2f2f2;border:1px solid #333;border-radius:12px;padding:11px 13px;font:inherit;text-align:right;cursor:pointer;margin:0 0 16px;transition:background .15s}
.new:hover,.item:hover,.item.on{background:#202020}
.list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px}
.item{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:10px;border-radius:10px;cursor:pointer;color:#d6d6d6;font-size:14px}
.item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.item button{background:none;border:0;cursor:pointer;opacity:.6;color:inherit}
.main{flex:1;display:flex;flex-direction:column;min-width:0;background:#000;position:relative}
.top{height:56px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 22px;border-bottom:1px solid #1e1e1e;color:#eee;font-size:15px}
.burger{display:none;background:none;border:0;color:#eee;font-size:1.35rem}
.msgs{flex:1;overflow-y:auto;padding:28px 24px 150px;display:flex;flex-direction:column;gap:26px;max-width:900px;width:100%;margin:0 auto;scrollbar-width:thin;scrollbar-color:#444 transparent}
.empty{margin:auto;color:#eee;font-size:1.8rem;font-weight:600;text-align:center}
.msg{padding:0;white-space:pre-wrap;line-height:1.8;max-width:100%;width:100%;word-wrap:break-word;font-size:15.5px}
.msg.user{background:#202020;align-self:flex-start;width:fit-content;max-width:min(78%,680px);padding:10px 17px;border-radius:22px;color:#f5f5f5}
.msg.assistant{background:transparent;border:0;align-self:stretch;color:#ededed}
.msg img{max-width:100%;border-radius:14px;display:block}
.real-image-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
.real-image-card{min-width:0;background:#111;border:1px solid #303030;border-radius:14px;padding:8px}
.real-image-card img{width:100%;height:190px;object-fit:cover}
.real-image-caption{font-size:12px;margin-top:7px;overflow-wrap:anywhere}
.real-image-credit{font-size:10px;color:#999;overflow-wrap:anywhere}
.msg a{color:#ddd}
.msg p{margin:0 0 10px}
.bar{position:absolute;bottom:0;left:0;right:0;display:flex;gap:9px;align-items:center;max-width:850px;width:calc(100% - 40px);margin:0 auto;padding:12px 0 20px;background:linear-gradient(180deg,transparent 0%,#000 20%)}
.composer{flex:1;position:relative;min-width:0;display:flex;align-items:center;gap:9px;background:#171717;border:1px solid #3a3a3a;border-radius:28px;padding:6px 9px;box-shadow:0 4px 24px #0008;min-height:56px}
.bar textarea{display:block;flex:1;width:100%;resize:none;max-height:130px;min-height:38px;background:transparent;color:#fff;border:0;outline:0;padding:7px 3px;font:inherit;min-width:0;line-height:1.5}
.inside-tool{width:34px;height:34px;flex-shrink:0;border-radius:50%;border:0;background:transparent;color:#aaa;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:23px}
.inside-tool:hover,.inside-tool.selected{background:#303030;color:#fff}
.inside-tool svg{width:19px;height:19px;fill:none}
.composer .send{width:36px;height:36px;flex-shrink:0;border-radius:50%;border:0;background:#f5f5f5;color:#111;font-size:1.25rem;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer}
.composer .send:disabled{opacity:.4;cursor:not-allowed}
.attachment-preview{position:absolute;bottom:62px;right:10px;background:#222;border:1px solid #444;border-radius:10px;padding:6px;display:flex;align-items:center;gap:8px;max-width:220px}

.bar textarea::placeholder{color:#929292}

.actions{display:flex;gap:5px;margin-top:12px;align-items:center}
.actions button{width:30px;height:30px;padding:6px;border:0;border-radius:8px;color:#999;display:flex;align-items:center;justify-content:center}
.actions button svg{width:17px;height:17px;fill:none}
.actions button:hover{background:#242424;color:#eee}
.message-more{position:relative}
.more-menu{position:absolute;bottom:35px;right:0;z-index:30;min-width:150px;padding:5px;background:#252525;border:1px solid #444;border-radius:10px;box-shadow:0 8px 28px #000b;display:flex;flex-direction:column}
.more-menu button{width:100%;height:auto;justify-content:flex-start;padding:9px 10px;color:#eee;font-size:13px;white-space:nowrap}
.more-menu button:hover{background:#383838}
.mic-tool svg{width:19px;height:19px}
.msg a{color:#8ab4f8;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
.actions button,.sources a{background:transparent;border:1px solid #383838;border-radius:8px;color:#aaa;padding:5px 9px;font:inherit;font-size:12px;text-decoration:none;cursor:pointer}
.actions button:hover,.sources a:hover{background:#202020;color:#fff}
.sources{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
.uploaded{max-width:240px;max-height:240px;object-fit:contain;border-radius:14px;display:block;margin-bottom:9px}
.attachment-preview{display:flex;align-items:center;gap:8px;padding:6px}
.attachment-preview img{width:42px;height:42px;object-fit:cover;border-radius:8px}
.attachment-preview span{font-size:12px;color:#ddd;overflow:hidden;text-overflow:ellipsis}
.attachment-preview button{border:0;background:#444;color:white;border-radius:50%;width:24px;height:24px}
.side-bottom{margin-top:auto;padding-top:10px;border-top:1px solid #292929;display:flex;flex-direction:column;gap:6px}
.side-account{display:flex;align-items:center;gap:10px;width:100%;padding:9px 7px;border:0;border-radius:10px;background:transparent;color:#eee;text-align:right;cursor:pointer}
.side-account:hover,.settings-entry:hover{background:#202020}
.account-avatar,.profile-big-avatar{display:grid;place-items:center;flex:none;border-radius:50%;background:#3c3c3c;color:#fff;font-weight:800}
.account-avatar{width:36px;height:36px;font-size:15px}
.account-copy{min-width:0;flex:1}
.account-copy strong,.account-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.account-copy strong{font-size:13px}.account-copy small{font-size:10px;color:#999;margin-top:2px}
.account-more{font-size:20px;color:#999}
.settings-entry{width:100%;padding:10px;border:0;border-radius:9px;background:transparent;color:#bbb;text-align:right;cursor:pointer;font-size:13px}
.panel-shade{position:fixed;inset:0;z-index:60;background:#000a;display:grid;place-items:center;padding:18px}
.settings-panel{width:min(420px,100%);padding:20px;background:#191919;border:1px solid #383838;border-radius:18px;box-shadow:0 20px 80px #000b;color:#eee}
.panel-heading{display:flex;align-items:center;justify-content:space-between;font-size:17px;margin-bottom:20px}
.panel-heading button{border:0;background:transparent;color:#aaa;font-size:25px;cursor:pointer}
.profile-big-avatar{width:66px;height:66px;margin:0 auto 20px;font-size:26px}
.panel-label{display:block;font-size:12px;color:#bbb;margin-bottom:7px}
.panel-input{width:100%;padding:11px 12px;border:1px solid #444;border-radius:10px;background:#0d0d0d;color:#fff;outline:0;font:inherit}
.panel-input:focus{border-color:#888}
.panel-muted{font-size:11px;color:#999;margin:10px 0 16px;overflow-wrap:anywhere}
.panel-primary,.panel-secondary,.theme-switch{border-radius:9px;padding:9px 13px;font:inherit;cursor:pointer}
.panel-primary{width:100%;border:0;background:#eee;color:#111;font-weight:700}
.panel-secondary{width:100%;margin-top:8px;border:1px solid #444;background:transparent;color:#ddd}
.setting-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-bottom:1px solid #303030}
.setting-row:last-child{border-bottom:0}
.setting-row strong,.setting-row small{display:block}.setting-row strong{font-size:13px}.setting-row small{font-size:11px;color:#999;margin-top:3px}
.setting-value{font-size:12px;color:#aaa}
.theme-switch{border:1px solid #484848;background:#292929;color:#eee;font-size:12px;white-space:nowrap}
.app.light{background:#f5f5f5;color:#202020}
.app.light .side{background:#ededed;border-color:#d5d5d5}
.app.light .logo,.app.light .top,.app.light .item,.app.light .side-account{color:#202020}
.app.light .new,.app.light .settings-entry{color:#333;border-color:#ccc}
.app.light .new:hover,.app.light .item:hover,.app.light .item.on,.app.light .side-account:hover,.app.light .settings-entry:hover{background:#ddd}
.app.light .main{background:#f5f5f5}
.app.light .top{border-color:#ddd}
.app.light .msg.user{background:#e4e4e4;color:#202020}
.app.light .msg.assistant{color:#202020}
.app.light .composer{background:#fff;border-color:#ccc}
.app.light .bar{background:linear-gradient(180deg,transparent 0%,#f5f5f5 20%)}
.app.light .bar textarea{color:#202020}
.app.light .empty{color:#202020}
@media(max-width:760px){.side-bottom{padding-bottom:8px}}

@media(max-width:760px){
.side{position:fixed;top:0;bottom:0;right:0;z-index:20;transform:translateX(100%);transition:.25s}
.side.open{transform:none}
.shade{position:fixed;inset:0;background:#0009;z-index:10}
.burger{display:block}
.msgs{padding:20px 15px 140px}
.bar{width:calc(100% - 24px);padding-bottom:12px}
.msg.user{max-width:88%}
}
`;
