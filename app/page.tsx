"use client";
import { useState } from "react";

type Message = { role: "user" | "assistant"; content: string; imageUrl?: string };
const ideas = [
  ["✦", "اكتب لي فكرة مشروع", "ساعدني أبدأ مشروعًا جديدًا"],
  ["⌘", "اشرح لي موضوعًا", "شرح بسيط وواضح لأي سؤال"],
  ["✎", "اكتب محتوى", "رسائل وأفكار ونصوص إبداعية"],
  ["⚡", "ساعدني في البرمجة", "حلّل الكود واشرح الأخطاء"]
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  async function send(value = input) {
    const text = value.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next); setInput(""); setBusy(true);
    try {
      if (imageMode) {
        const res = await fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "تعذر إنشاء الصورة");
        setMessages([...next, { role: "assistant", content: "تفضل، هذه الصورة التي طلبتها:", imageUrl: data.imageUrl }]);
      } else {
        const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.map(({role,content})=>({role,content})) }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "حصل خطأ أثناء الاتصال");
        setMessages([...next, { role: "assistant", content: data.reply || data.text || "لم يصل رد." }]);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "حصل خطأ غير متوقع";
      setMessages([...next, { role: "assistant", content: `عذرًا، ${message}` }]);
    } finally { setBusy(false); }
  }

  function fresh() { setMessages([]); setInput(""); setImageMode(false); }

  async function copyMessage(content: string, index: number) {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(index);
      window.setTimeout(() => setCopied((v) => v === index ? null : v), 1800);
    } catch { setCopied(null); }
  }

  async function shareMessage(content: string, imageUrl?: string) {
    const shareText = imageUrl ? content + "\n" + imageUrl : content;
    if (navigator.share) {
      try { await navigator.share({ title: "4hab AI", text: shareText, url: imageUrl }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
    }
  }

  return <main className="shell">
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brandmark">4</span><span>4hab <b>AI</b></span></a>
      <button className="newchat" onClick={fresh}><span>＋</span> محادثة جديدة</button>
      <div className="sidecaption">مساحة العمل</div>
      <div className="sideitem active"><span>✦</span> مساعد 4hab الذكي</div>
      <div className="sidefoot"><div className="profilemark">4</div><div><strong>4hab AI</strong><small>ذكاء يساعدك تصنع أكثر.</small></div></div>
    </aside>

    <section className="main">
      <header className="topbar">
        <div className="mobilebrand"><span className="brandmark">4</span><b>4hab AI</b></div>
        <span className="model">4hab AI <small>مساعدك الذكي</small></span>
        <span className="online"><i/> متصل</span>
      </header>

      <div className="workspace">
        {messages.length === 0 ? <section className="welcome">
          <div className="heroicon">4</div><p className="eyebrow">فكّر. اسأل. ابتكر.</p>
          <h1>أهلًا بك في <span>4hab AI</span></h1>
          <p className="subtitle">مساحتك الذكية للأفكار والإبداع. اسأل أو أنشئ صورة بالذكاء الاصطناعي.</p>
          <div className="ideas">{ideas.map(([icon,title,desc])=><button key={title} onClick={()=>send(title)} className="idea"><span>{icon}</span><strong>{title}</strong><small>{desc}</small><b className="idea-arrow">↗</b></button>)}</div>
        </section> : <section className="messages">
          {messages.map((m,i)=><article key={i} className={`message ${m.role}`}>
            <div className="avatar">{m.role==="user"?"أ":"4"}</div>
            <div className="message-body">
              <div className="message-label">{m.role==="user"?"أنت":"4hab AI"}</div>
              {m.content && <div className="bubble" dir="auto">{m.content}</div>}
              {m.imageUrl && <div className="generated-image"><img src={m.imageUrl} alt="صورة تم إنشاؤها بواسطة 4hab AI" onError={(e)=>{e.currentTarget.alt="تعذر تحميل الصورة. قد تكون الخدمة المجانية مزدحمة؛ جرّب مرة أخرى بعد قليل.";}}/><a href={m.imageUrl} target="_blank" rel="noreferrer">فتح الصورة بالحجم الكامل ↗</a></div>}
              {m.role === "assistant" && <div className="message-actions">
                <button onClick={()=>copyMessage(m.imageUrl || m.content,i)} title="نسخ"><span>{copied===i?"✓":"▢"}</span>{copied===i?"تم النسخ":"نسخ"}</button>
                <button onClick={()=>shareMessage(m.content,m.imageUrl)} title="مشاركة"><span>↗</span>مشاركة</button>
              </div>}
            </div>
          </article>)}
          {busy&&<div className="typing"><span className="typing-dot"/> {imageMode?"4hab AI ينشئ الصورة...":"4hab AI يكتب..."}</div>}
        </section>}

        <div className="composer">
          <form onSubmit={e=>{e.preventDefault();send();}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={imageMode?"اكتب وصف الصورة التي تريد إنشاءها...":"راسل 4hab AI..."} rows={1}/>
            <button disabled={!input.trim()||busy} aria-label="إرسال" title="إرسال">↑</button>
          </form>
          <div className="composer-tools">
            <button type="button" className={imageMode?"tool active":"tool"} onClick={()=>setImageMode(!imageMode)} disabled={busy}><span>▧</span> {imageMode?"وضع إنشاء الصور مفعّل":"إنشاء صورة"}</button>
            <p><span>✦</span> قد يخطئ الذكاء الاصطناعي أحيانًا؛ راجع المعلومات المهمة.</p>
          </div>
        </div>
      </div>
    </section>
  </main>;
}
