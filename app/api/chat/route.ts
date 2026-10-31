import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages)
      ? body.messages
      : [{ role: "user", content: body.message || "" }];

    const r = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          {
            role: "system",
            content: "You are 4hab AI, a helpful assistant. Reply in the user's language.",
          },
          ...messages.slice(-20),
        ],
      }),
    });

    if (!r.ok) {
      console.error("4hab AI Pollinations error:", r.status, await r.text());
      return NextResponse.json(
        { text: "تعذر الاتصال بخدمة الذكاء الاصطناعي. حاول مرة أخرى.", reply: "تعذر الاتصال بخدمة الذكاء الاصطناعي. حاول مرة أخرى." },
        { status: 502 }
      );
    }

    const d = await r.json();
    const text = d.choices?.[0]?.message?.content || "";
    return NextResponse.json({ text, reply: text, message: text });
  } catch (e) {
    console.error("4hab AI chat error", e);
    return NextResponse.json(
      { text: "تعذر الاتصال، حاول مرة أخرى.", reply: "تعذر الاتصال، حاول مرة أخرى." },
      { status: 500 }
    );
  }
}
