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

    const url =
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(prompt) +
      `?model=flux&width=768&height=768&nologo=true&seed=${Date.now()}`;

    // Return both keys because the frontend supports either response shape.
    return Response.json({ url, imageUrl: url, prompt });
  } catch (error) {
    console.error("Image generation error:", error);
    return Response.json({ error: "تعذر تجهيز طلب الصورة. حاول مرة أخرى." }, { status: 500 });
  }
}
