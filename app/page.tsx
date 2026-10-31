"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; image?: string; attachment?: string; sources?: {title:string;url:string}[] };
type Chat = { id: string; title: string; messages: Msg[] };

const KEY = "4hab-chats";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

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
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      try { localStorage.setItem(KEY, JSON.stringify({ chats, cur })); } catch {}
    }
  }, [chats, cur, ready]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, cur, busy]);

  function newChat() {
    const c: Chat = { id: uid(), title: "محادثة جديدة", messages: [] };
    setChats((p) => [c, ...p]);
    setCur(c.id);
    setMenu(false);
    setImgMode(false);
  }

  function delChat(id: string) {
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
      if (imgMode) {
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
    <div className="app" dir="rtl">
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
      </aside>
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
              {m.image ? (
                <div>
                  {m.content && <p>{m.content}</p>}
                  <a href={m.image} target="_blank" rel="noreferrer">
                    <img src={m.image} alt="صورة تم إنشاؤها بواسطة 4hab AI" />
                  </a>
                </div>
              ) : <><div>{m.content}</div>{m.sources?.length ? <div className="sources">{m.sources.map((s,j)=><a key={j} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div> : null}{m.role === "assistant" && <div className="actions"><button onClick={() => navigator.clipboard.writeText(m.content)} title="نسخ الرد">نسخ</button><button onClick={() => navigator.clipboard.writeText(m.content)} title="نسخ">⧉</button></div>}</>}
            </div>
          ))}
          {busy && <div className="msg assistant">…</div>}
          <div ref={endRef} />
        </div>
        <div className="bar">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f=e.target.files?.[0]; if(!f)return; if(f.size>8*1024*1024){alert("حجم الصورة يجب أن يكون أقل من 8MB");e.target.value="";return;} const reader=new FileReader(); reader.onload=()=>{setAttachment(String(reader.result));setAttachmentName(f.name);}; reader.readAsDataURL(f); e.target.value=""; }} />
          <button className="tool" onClick={() => fileRef.current?.click()} title="إرفاق صورة" aria-label="إرفاق صورة">＋</button>
          <button className={"tool" + (imgMode ? " selected" : "")} onClick={() => setImgMode(!imgMode)} title="إنشاء صورة" aria-label="تبديل وضع الصور">🎨</button>
          <div className="composer"><textarea
            rows={1}
            value={input}
            placeholder={imgMode ? "اوصف الصورة…" : "اسأل 4hab AI أي شيء…"}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />{attachment && <div className="attachment-preview"><img src={attachment} alt="معاينة المرفق"/><span>{attachmentName}</span><button onClick={()=>{setAttachment(null);setAttachmentName("");}}>×</button></div>}</div>
          <button className="send" onClick={send} disabled={busy || (!input.trim() && !attachment)} aria-label="إرسال">↑</button>
        </div>
      </main>
    </div>
  );
}

const css = `
*{box-sizing:border-box}
body{margin:0;background:#212121;color:#f5f5f5;font-family:system-ui,Tahoma,sans-serif}
.app{display:flex;height:100dvh}
.side{width:270px;flex-shrink:0;background:#171717;border-left:1px solid #303030;display:flex;flex-direction:column;padding:12px}
.logo{font-weight:800;font-size:1.3rem;padding:8px;color:#fff}
.new{background:#fff;color:#111;border:0;border-radius:12px;padding:10px;font:inherit;font-weight:700;cursor:pointer;margin:8px 0}
.list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px}
.item{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:9px 10px;border-radius:10px;cursor:pointer;color:#c9c5ee}
.item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.item:hover,.item.on{background:#292929}
.item button{background:none;border:0;cursor:pointer;opacity:.6;color:inherit}
.main{flex:1;display:flex;flex-direction:column;min-width:0}
.top{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #333;color:#eee}
.burger{display:none;background:none;border:0;color:#f0eeff;font-size:1.4rem}
.msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;max-width:820px;width:100%;margin:0 auto}
.empty{margin:auto;color:#9e9bc7;font-size:1.4rem;text-align:center}
.msg{padding:12px 14px;border-radius:16px;white-space:pre-wrap;line-height:1.7;max-width:88%;word-wrap:break-word}
.msg.user{background:#303030;align-self:flex-start}
.msg.assistant{background:#262626;border:1px solid #383838;align-self:flex-end}
.msg img{max-width:100%;border-radius:12px;display:block}
.msg a{color:#c8baff}
.msg p{margin:0 0 8px}
.bar{display:flex;gap:8px;align-items:flex-end;max-width:820px;width:100%;margin:0 auto;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px))}
.composer{flex:1;position:relative;min-width:0}.bar textarea{width:100%;resize:none;max-height:140px;background:#303030;color:#fff;border:1px solid #444;border-radius:24px;padding:12px;font:inherit;min-width:0}
.send,.tool{width:46px;height:46px;flex-shrink:0;border-radius:50%;border:1px solid #555;background:#303030;color:#fff;font-size:1.2rem;cursor:pointer}
.send{background:#fff;color:#111;border:0;font-weight:800}
.tool.selected{background:#fff;color:#111}
.send:disabled{opacity:.45;cursor:not-allowed}.actions{display:flex;gap:8px;margin-top:10px}.actions button,.sources a{background:transparent;border:1px solid #555;border-radius:8px;color:#ddd;padding:5px 9px;font:inherit;font-size:12px;text-decoration:none;cursor:pointer}.sources{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.uploaded{max-width:220px;max-height:220px;object-fit:contain;border-radius:12px;display:block;margin-bottom:8px}.attachment-preview{display:flex;align-items:center;gap:8px;padding:6px}.attachment-preview img{width:42px;height:42px;object-fit:cover;border-radius:8px}.attachment-preview span{font-size:12px;color:#ddd;overflow:hidden;text-overflow:ellipsis}.attachment-preview button{border:0;background:#555;color:white;border-radius:50%;width:24px;height:24px}
@media(max-width:760px){
.side{position:fixed;top:0;bottom:0;right:0;z-index:20;transform:translateX(100%);transition:.25s}
.side.open{transform:none}
.shade{position:fixed;inset:0;background:#0008;z-index:10}
.burger{display:block}
}
`;
