export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return Response.json({ error: "اكتب وصف الصورة أولًا." }, { status: 400 });
    }
    if (prompt.length > 1000) {
      return Response.json({ error: "وصف الصورة طويل جدًا. اختصره إلى 1000 حرف." }, { status: 400 });
    }

    const encodedPrompt = encodeURIComponent(prompt);
    const apiKey = process.env.POLLINATIONS_API_KEY;

    // Use the current authenticated endpoint when a Pollinations key is configured.
    // Otherwise try the legacy free endpoint, which may enforce anonymous rate limits.
    const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=black-forest-labs/flux.1-schnell&width=768&height=768`;

    const response = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(120000),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Pollinations image request failed:", response.status, detail.slice(0, 1000));
      let providerMessage = "";
      try { const parsed = JSON.parse(detail); providerMessage = parsed?.error?.message || parsed?.error || parsed?.message || ""; } catch { providerMessage = detail.slice(0, 250); }
      if (response.status === 401 || response.status === 403) {
        return Response.json({ error: "خدمة الصور تحتاج مفتاح Pollinations صالح. أضف POLLINATIONS_API_KEY في إعدادات Vercel." }, { status: 502 });
      }
      if (response.status === 402 || response.status === 429) {
        return Response.json({ error: "وصلت للحد المجاني لتوليد الصور حاليًا. انتظر قليلًا ثم جرّب مرة أخرى." }, { status: 429 });
      }
      return Response.json({ error: `Pollinations رفضت الطلب (${response.status}): ${String(providerMessage || "سبب غير موضح").slice(0, 250)}` }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      const detail = await response.text().catch(() => "");
      console.error("Pollinations returned non-image response:", contentType, detail.slice(0, 500));
      return Response.json({ error: "خدمة الصور رجّعت استجابة غير صالحة. جرّب مرة أخرى لاحقًا." }, { status: 502 });
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) {
      return Response.json({ error: "الصورة التي رجعت من الخدمة فارغة. حاول مرة أخرى." }, { status: 502 });
    }

    // Return the actual image bytes as a data URL so the chat never stores a dead provider link.
    const imageUrl = `data:${contentType};base64,${bytes.toString("base64")}`;
    return Response.json({ url: imageUrl, imageUrl, prompt });
  } catch (error) {
    console.error("Image generation error:", error);
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "توليد الصورة أخذ وقتًا طويلًا. حاول مرة أخرى."
      : "تعذر تجهيز الصورة الآن. حاول مرة أخرى.";
    return Response.json({ error: message }, { status: 500 });
  }
}
