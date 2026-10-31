type Msg = { role: string; content: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: Msg[] = body.messages || [{ role: "user", content: body.message || "" }];
    const contents = messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You are 4hab AI, a helpful assistant. Reply in the user's language." }],
          },
          contents,
        }),
      }
    );

    const d = await r.json();
    if (!r.ok) console.error("Gemini error", JSON.stringify(d));
    const text: string =
      d.candidates?.[0]?.content?.parts?.[0]?.text || "تعذر الرد، حاول مجددًا.";
    return Response.json({ text, reply: text, message: text });
  } catch (e) {
    console.error(e);
    return Response.json({ text: "خطأ في الاتصال." }, { status: 500 });
  }
}