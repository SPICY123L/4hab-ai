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

    const categoryParams = new URLSearchParams({
      action: "query",
      format: "json",
      list: "categorymembers",
      cmtitle: "Category:Mohamed Salah",
      cmtype: "file",
      cmlimit: "30",
    });
    const categoryResponse = await fetch(`https://commons.wikimedia.org/w/api.php?${categoryParams.toString()}`, {
      headers: { "User-Agent": "4habAI/1.0 (real image search)" },
      cache: "no-store",
    });
    if (!categoryResponse.ok) {
      console.error("Commons category request failed:", categoryResponse.status);
      return Response.json({ error: "مصدر الصور لم يستجب. حاول مرة أخرى." }, { status: 502 });
    }
    const categoryData = await categoryResponse.json();
    const members: { pageid: number; title: string }[] = categoryData.query?.categorymembers || [];
    if (!members.length) return Response.json({ images: [], query });

    const imageParams = new URLSearchParams({
      action: "query",
      format: "json",
      pageids: members.map((item) => item.pageid).join("|"),
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "900",
    });
    const imageResponse = await fetch(`https://commons.wikimedia.org/w/api.php?${imageParams.toString()}`, {
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
