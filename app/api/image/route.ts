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

    const seed = Date.now();
    const url = new URL("https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt));
    url.searchParams.set("width", "1024");
    url.searchParams.set("height", "1024");
    url.searchParams.set("nologo", "true");
    url.searchParams.set("safe", "true");
    url.searchParams.set("seed", String(seed));

    const imageUrl = url.toString();
    // Return both names for compatibility with old and new frontends.
    return Response.json({ url: imageUrl, imageUrl, prompt });
  } catch (error) {
    console.error("Image generation error", error);
    return Response.json({ error: "تعذر تجهيز طلب الصورة. حاول مرة أخرى." }, { status: 500 });
  }
}
