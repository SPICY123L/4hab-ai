type CommonsPage = {
  pageid?: number;
  title?: string;
  imageinfo?: { thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: { Artist?: { value?: string }; LicenseShortName?: { value?: string } } }[];
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim().slice(0, 120);
    if (!query) return Response.json({ error: "اكتب اسم الشخص أو الشيء الذي تبحث عن صوره." }, { status: 400 });

    const searchParams = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: "30",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "900",
    });
    const imageResponse = await fetch(`https://commons.wikimedia.org/w/api.php?${searchParams.toString()}`, {
      headers: { "User-Agent": "4habAI/1.0 (real image search)" },
      cache: "no-store",
    });
    if (!imageResponse.ok) return Response.json({ error: "تعذر تحميل الصور من المصدر." }, { status: 502 });

    const imageData = await imageResponse.json();
    const pages: CommonsPage[] = Object.values(imageData.query?.pages || {});
    const images = pages.flatMap((page) => {
      const info = page.imageinfo?.[0];
      const src = info?.thumburl || info?.url;
      if (!src || !/^https:\/\//.test(src)) return [];
      const clean = (value?: string) => (value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim().slice(0, 300);
      return [{
        title: (page.title || "صورة").replace(/^File:/, ""),
        url: src,
        pageUrl: info?.descriptionurl || "",
        artist: clean(info?.extmetadata?.Artist?.value),
        license: clean(info?.extmetadata?.LicenseShortName?.value),
      }];
    }).slice(0, 12);
    return Response.json({ images, query });
  } catch (error) {
    console.error("Real image search error:", error);
    return Response.json({ error: "حدث خطأ أثناء البحث عن الصور." }, { status: 500 });
  }
}
