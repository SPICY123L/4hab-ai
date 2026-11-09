"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; image?: string; attachment?: string; sources?: {title:string;url:string}[]; images?: {title:string;url:string;pageUrl?:string;artist?:string;license?:string}[] };
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
              ) : <><div>{m.content}</div>{m.sources?.length ? <div className="sources">{m.sources.map((s,j)=><a key={j} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div> : null}{m.role === "assistant" && <div className="actions"><button onClick={() => navigator.clipboard.writeText(m.content)} title="نسخ الرد">نسخ</button><button onClick={() => navigator.clipboard.writeText(m.content)} title="نسخ">⧉</button></div>}</>}
            </div>
          ))}
          {busy && <div className="msg assistant">…</div>}
          <div ref={endRef} />
        </div>
        <div className="bar">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f=e.target.files?.[0]; if(!f)return; if(f.size>8*1024*1024){alert("حجم الصورة يجب أن يكون أقل من 8MB");e.target.value="";return;} const reader=new FileReader(); reader.onload=()=>{setAttachment(String(reader.result));setAttachmentName(f.name);}; reader.readAsDataURL(f); e.target.value=""; }} />
          <button className="tool" onClick={() => fileRef.current?.click()} title="إرفاق صورة" aria-label="إرفاق صورة">＋</button>
          <button className={"tool image-tool" + (imgMode ? " selected" : "")} onClick={() => setImgMode(!imgMode)} title="إنشاء صورة" aria-label="تبديل وضع الصور"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="8.5" cy="8.5" r="1.7" fill="currentColor"/><path d="m4 17 5-5 3.5 3.5 2.5-2.5 5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
.bar{position:absolute;bottom:0;left:0;right:0;display:flex;gap:9px;align-items:flex-end;max-width:850px;width:calc(100% - 40px);margin:0 auto;padding:12px 0 20px;background:linear-gradient(180deg,transparent 0%,#000 20%)}
.composer{flex:1;position:relative;min-width:0;background:#171717;border:1px solid #3a3a3a;border-radius:28px;padding:7px 12px;box-shadow:0 4px 24px #0008}
.bar textarea{display:block;width:100%;resize:none;max-height:160px;background:transparent;color:#fff;border:0;outline:0;padding:8px 4px;font:inherit;min-width:0;line-height:1.6}
.bar textarea::placeholder{color:#929292}
.send,.tool{width:42px;height:42px;flex-shrink:0;border-radius:50%;border:1px solid #3d3d3d;background:#202020;color:#f5f5f5;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,border-color .15s}
.tool:hover{background:#303030}
.image-tool svg{width:20px;height:20px}
.send{background:#f5f5f5;color:#111;border:0;font-size:1.35rem;font-weight:700}
.send:disabled{opacity:.4;cursor:not-allowed}
.tool.selected{background:#f5f5f5;color:#111;border-color:#f5f5f5}
.actions{display:flex;gap:8px;margin-top:12px}
.actions button,.sources a{background:transparent;border:1px solid #383838;border-radius:8px;color:#aaa;padding:5px 9px;font:inherit;font-size:12px;text-decoration:none;cursor:pointer}
.actions button:hover,.sources a:hover{background:#202020;color:#fff}
.sources{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
.uploaded{max-width:240px;max-height:240px;object-fit:contain;border-radius:14px;display:block;margin-bottom:9px}
.attachment-preview{display:flex;align-items:center;gap:8px;padding:6px}
.attachment-preview img{width:42px;height:42px;object-fit:cover;border-radius:8px}
.attachment-preview span{font-size:12px;color:#ddd;overflow:hidden;text-overflow:ellipsis}
.attachment-preview button{border:0;background:#444;color:white;border-radius:50%;width:24px;height:24px}
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
