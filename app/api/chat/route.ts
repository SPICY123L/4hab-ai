import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "مفتاح الذكاء الاصطناعي غير مضبوط بعد. أضف OPENAI_API_KEY في إعدادات Vercel." }, { status: 503 });
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: "أنت 4hab AI، مساعد ذكي وودود. أجب بلغة المستخدم، وفضّل العربية المصرية البسيطة عندما يكتب المستخدم بالعربية. كن واضحًا ومفيدًا.",
      input: messages.map((m: {role:string;content:string}) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
    });
    return NextResponse.json({ reply: response.output_text || "لم أتمكن من إنشاء رد. جرّب مرة أخرى." });
  } catch (error) {
    console.error("4hab AI chat error", error);
    return NextResponse.json({ error: "تعذر الاتصال بخدمة الذكاء الاصطناعي. حاول مرة أخرى." }, { status: 500 });
  }
}
