"use client";
import { useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
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
  async function send(value = input) {
    const text = value.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next); setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "حصل خطأ أثناء الاتصال");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "حصل خطأ غير متوقع";
      setMessages([...next, { role: "assistant", content: `عذرًا، ${message}` }]);
    } finally { setBusy(false); }
  }
  function fresh() { setMessages([]); setInput(""); }
  return <main className="shell">
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brandmark">4</span><span>4hab <b>AI</b></span></a>
      <button className="newchat" onClick={fresh}>＋ محادثة جديدة</button>
      <div className="sidecaption">مساحة العمل</div><div className="sideitem active">✦ مساعد 4hab الذكي</div>
      <div className="sidefoot">4hab AI<br/>ذكاء يساعدك تصنع أكثر.</div>
    </aside>
    <section className="main">
      <header className="topbar"><span className="model">✦ 4hab AI <small>مساعدك الذكي</small></span><span className="online"><i/> متصل</span></header>
      <div className="workspace">
        {messages.length === 0 ? <section className="welcome">
          <div className="heroicon">4</div><p className="eyebrow">فكّر. اسأل. ابتكر.</p>
          <h1>أهلًا بك في <span>4hab AI</span></h1>
          <p className="subtitle">مساحتك الذكية للأفكار والإبداع. ابدأ بسؤال أو اختر اقتراحًا.</p>
          <div className="ideas">{ideas.map(([icon,title,desc])=><button key={title} onClick={()=>send(title)} className="idea"><span>{icon}</span><strong>{title}</strong><small>{desc}</small></button>)}</div>
        </section> : <section className="messages">{messages.map((m,i)=><article key={i} className={`message ${m.role}`}><div className="avatar">{m.role==="user"?"أنت":"4"}</div><div className="bubble">{m.content}</div></article>)}{busy&&<div className="typing">4hab AI يكتب<span>…</span></div>}</section>}
        <div className="composer"><form onSubmit={e=>{e.preventDefault();send();}}><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="اسأل 4hab AI أي شيء..." rows={1}/><button disabled={!input.trim()||busy} aria-label="إرسال">↑</button></form><p>قد يخطئ الذكاء الاصطناعي أحيانًا؛ راجع المعلومات المهمة.</p></div>
      </div>
    </section>
  </main>;
}
