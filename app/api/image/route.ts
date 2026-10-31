export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return Response.json({ error: "اكتب وصف الصورة أولًا." }, { status: 400 });
    if (prompt.length > 1000) return Response.json({ error: "وصف الصورة طويل جدًا. اختصره إلى 1000 حرف." }, { status: 400 });

    const key = process.env.GEMINI_API_KEY;
    if (!key) return Response.json({ error: "مفتاح Gemini غير مضبوط في إعدادات Vercel." }, { status: 503 });

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Generate one high-quality image based on this prompt: " + prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini image error", data);
      return Response.json({ error: data.error?.message || "خدمة إنشاء الصور لم تقبل الطلب. تأكد من تفعيل صلاحية Gemini API." }, { status: response.status });
    }
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part.inlineData?.data);
    if (!imagePart) {
      return Response.json({ error: "الموديل لم يُرجع صورة. جرّب وصفًا آخر." }, { status: 502 });
    }
    const mime = imagePart.inlineData.mimeType || "image/png";
    const imageUrl = "data:" + mime + ";base64," + imagePart.inlineData.data;
    return Response.json({ imageUrl, url: imageUrl, prompt });
  } catch (error) {
    console.error("Image generation error", error);
    return Response.json({ error: "تعذر إنشاء الصورة الآن. حاول مرة أخرى." }, { status: 500 });
  }
}
