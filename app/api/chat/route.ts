type Msg = { role: string; content: string };
type Source = { title: string; url: string };
const SYS = "You are 4hab AI, a helpful assistant. Reply in the user's language. When current facts, news, prices, or specific websites are relevant, use Google Search and cite sources. Never invent links or claim you searched if you did not.";
const MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

async function gemini(model: string, messages: Msg[]) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY || "",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYS }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [ ...(m.content ? [{ text: m.content }] : []), ...(typeof (m as any).image === "string" && (m as any).image.startsWith("data:") ? [{ inlineData: { mimeType: (m as any).image.slice(5, (m as any).image.indexOf(";")), data: (m as any).image.split(",")[1] } }] : []) ],
      })),
      tools: [{ google_search: {} }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(model + " " + JSON.stringify(d));
  const candidate = d.candidates?.[0];
  const answer = candidate?.content?.parts?.map((p: {text?: string}) => p.text || "").join("\n").trim() || "";
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const sources: Source[] = chunks
    .map((chunk: {web?: {uri?: string; title?: string}}) => chunk.web)
    .filter((web: {uri?: string; title?: string} | undefined): web is {uri: string; title?: string} => !!web?.uri && /^https?:\/\//i.test(web.uri))
    .map((web: {uri: string; title?: string}) => ({ title: web.title || new URL(web.uri).hostname, url: web.uri }))
    .filter((source: Source, index: number, all: Source[]) => all.findIndex((item) => item.url === source.url) === index)
    .slice(0, 8);
  return { text: answer, sources };
}

async function pollinations(messages: Msg[]) {
  const r = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai", messages: [{ role: "system", content: SYS }, ...messages] }),
  });
  if (!r.ok) throw new Error("تعذر الاتصال بالخدمة الاحتياطية");
  const d = await r.json();
  return d.choices?.[0]?.message?.content || "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: Msg[] = (body.messages || [{ role: "user", content: body.message || "" }]).slice(-20);
    let answer = "";
    let sources: Source[] = [];
    for (const model of MODELS) {
      try {
        const result = await gemini(model, messages);
        answer = result.text;
        sources = result.sources;
        if (answer) break;
      } catch (error) {
        console.error("Gemini error:", String(error));
      }
    }
    if (!answer) {
      try { answer = await pollinations(messages); }
      catch (error) { console.error("Fallback error:", String(error)); }
    }
    answer = answer || "الخدمة مزدحمة الآن، حاول بعد قليل.";
    return Response.json({ text: answer, reply: answer, message: answer, sources });
  } catch (error) {
    console.error("Chat route error:", error);
    return Response.json({ error: "تعذر الاتصال بالمساعد حاليًا. حاول مرة أخرى." }, { status: 500 });
  }
}