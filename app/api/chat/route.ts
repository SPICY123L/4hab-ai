type Msg = { role: string; content: string };
type Source = { title: string; url: string };
type RealImage = { title:string; url:string; pageUrl?:string; artist?:string; license?:string };
type AnswerBlock = { type:"text"|"image"; text?:string; images?:RealImage[] };
const SYS = "You are 4hab AI, a warm, natural conversational AI companion. Reply in the user's language and naturally match their tone and dialect. For casual chat, talk like a friendly person: relaxed, spontaneous, kind, playful when appropriate, and comfortable with jokes and everyday small talk. Do not turn every message into a formal explanation, list, or lecture. Ask natural follow-up questions when it helps the conversation flow, but do not interrogate the user. Keep casual replies concise and human-sounding; give detailed structured answers only when the user asks for information or help that needs them. Be honest that you are an AI.  When discussing sexuality, do not automatically refuse merely because the topic is sensitive or adult: answer maturely and without judgment about sexual health, relationships, consent, contraception, anatomy, and consensual adult topics. For useful factual explanations about identifiable real people, places, landmarks, animals, objects, or events, insert image markers in the answer where a real photo would genuinely help. Use the exact format [[IMAGE: short specific search phrase in English]] on its own line, ideally 1-3 markers per answer. Do not add markers to casual chat, abstract topics, or when a photo is not useful. These markers will be replaced with real Wikimedia Commons photographs. Never claim an image is a photo of a specific person/event unless the image source supports it. Keep sexual discussion educational or non-graphic; do not create explicit pornographic descriptions. Never sexualize minors or assist with exploitation, coercion, or non-consensual sexual content. When current facts, news, prices, or specific websites are relevant, use Google Search and cite sources. Never invent links or claim you searched if you did not.";
const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];

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


async function searchRealImages(query: string): Promise<RealImage[]> {
  const normalized = query.toLowerCase();
  const fallbacks = /giza|pyramid|khufu|khafre|menkaure|sphinx|ahram|هرم|أهرام/.test(normalized)
    ? ["Giza pyramids Egypt", "Pyramids of Giza panoramic view", "Great Pyramid of Khufu Giza", "Pyramid of Khafre Giza", "Pyramid of Menkaure Giza", "Great Sphinx of Giza"]
    : [query, query + " photograph"];
  const collected: RealImage[] = [];
  const seen = new Set<string>();
  const clean = (value?: string) => (value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim().slice(0, 250);
  for (const term of fallbacks) {
    if (collected.length >= 3) break;
    try {
      const params = new URLSearchParams({
        action: "query", format: "json", origin: "*", generator: "search",
        gsrsearch: term, gsrnamespace: "6", gsrlimit: "8",
        prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "900",
      });
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
        headers: { "User-Agent": "4habAI/1.1 (real image search)" }, cache: "no-store",
      });
      if (!response.ok) continue;
      const data = await response.json();
      const pages = Object.values(data.query?.pages || {}) as any[];
      for (const page of pages) {
        const info = page.imageinfo?.[0];
        const url = info?.thumburl || info?.url;
        if (!url || !/^https:\/\//.test(url) || seen.has(url)) continue;
        seen.add(url);
        collected.push({
          title: (page.title || "Photo").replace(/^File:/, ""),
          url,
          pageUrl: info.descriptionurl || "",
          artist: clean(info.extmetadata?.Artist?.value),
          license: clean(info.extmetadata?.LicenseShortName?.value),
        });
        if (collected.length >= 3) break;
      }
    } catch (error) {
      console.error("Wikimedia image search failed:", term, String(error));
    }
  }
  return collected;
}

function makeAnswerBlocks(answer: string, imagesByQuery: Map<string, RealImage[]>): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  const pattern = /\[\[IMAGE:\s*([^\]]+)\]\]/g;
  let last = 0;
  for (const match of answer.matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = answer.slice(last, index).trim();
    if (before) blocks.push({ type:"text", text:before });
    const query = match[1].trim();
    const images = imagesByQuery.get(query) || [];
    if (images.length) blocks.push({ type:"image", images });
    last = index + match[0].length;
  }
  const tail = answer.slice(last).trim();
  if (tail) blocks.push({ type:"text", text:tail });
  return blocks;
}


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: Msg[] = (body.messages || [{ role: "user", content: body.message || "" }]).slice(-20);
    let answer = "";
    let sources: Source[] = [];
    let lastGeminiError = "";
    for (const model of MODELS) {
      try {
        const result = await gemini(model, messages);
        answer = result.text;
        sources = result.sources;
        if (answer) break;
      } catch (error) {
        lastGeminiError = String(error).slice(0, 700);
        console.error("Gemini error:", lastGeminiError);
      }
    }
    if (!answer) {
      console.error("All Gemini models failed. Last error:", lastGeminiError);
      answer = "تعذّر تشغيل Gemini. السبب التقني: " + (lastGeminiError || "لم يصل رد من الخدمة") + ". لا ترسل مفتاح API لأي شخص؛ ابعتلي نص الخطأ الظاهر هنا فقط.";
    }
    const asksAboutGiza = /giza|pyramid|khufu|khafre|menkaure|sphinx|أهرام|اهرام|هرم|الجيزة/.test(messages[messages.length - 1]?.content || "");
    if (asksAboutGiza && !/\[\[IMAGE:/.test(answer)) {
      answer += "\n\n[[IMAGE: Giza pyramids Egypt]]\n\n[[IMAGE: Great Pyramid of Khufu Giza]]\n\n[[IMAGE: Great Sphinx of Giza]]";
    }
    const imageQueries = [...answer.matchAll(/\[\[IMAGE:\s*([^\]]+)\]\]/g)].map((match) => match[1].trim()).slice(0, 3);
    const imageResults = await Promise.all(imageQueries.map(async (query) => [query, await searchRealImages(query)] as const));
    const blocks = makeAnswerBlocks(answer, new Map(imageResults));
    const cleanAnswer = answer.replace(/\[\[IMAGE:\s*([^\]]+)\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
    return Response.json({ text: cleanAnswer, reply: cleanAnswer, message: cleanAnswer, sources, blocks });
  } catch (error) {
    console.error("Chat route error:", error);
    return Response.json({ error: "تعذر الاتصال بالمساعد حاليًا. حاول مرة أخرى." }, { status: 500 });
  }
}