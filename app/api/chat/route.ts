type Msg = { role: string; content: string };
const SYS = "You are 4hab AI, a helpful assistant. Reply in the user's language.";
const MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

async function gemini(model: string, messages: Msg[]) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY || "",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      }),
    }
  );
  const d = await r.json();
  if (!r.ok) throw new Error(model + " " + JSON.stringify(d));
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function pollinations(messages: Msg[]) {
  const r = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai",
      messages: [{ role: "system", content: SYS }, ...messages],
    }),
  });
  const d = await r.json();
  return d.choices?.[0]?.message?.content || "";
}

export async function POST(req: Request) {
  const body = await req.json();
  const messages: Msg[] = (body.messages || [{ role: "user", content: body.message || "" }]).slice(-20);
  let text = "";
  for (const m of MODELS) {
    try {
      text = await gemini(m, messages);
      if (text) break;
    } catch (e) {
      console.error("Gemini error", String(e));
    }
  }
  if (!text) {
    try { text = await pollinations(messages); } catch (e) { console.error(e); }
  }
  text = text || "الخدمة مزدحمة الآن، حاول بعد قليل.";
  return Response.json({ text, reply: text, message: text });
}