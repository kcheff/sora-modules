// Helper for Sora's native network fetcher
async function httpGet(url, headers = {}) {
  const res = await fetchv2(url, headers, "GET", null);
  if (typeof res === "string") {
    try { return JSON.parse(res); } catch (e) { return res; }
  }
  if (res && typeof res.json === "function") return await res.json();
  if (res && typeof res.text === "function") {
    const t = await res.text();
    try { return JSON.parse(t); } catch (e) { return t; }
  }
  return res;
}

// 1. Search manga
async function searchResults(keyword) {
  const url = `https://api.mangadex.org/manga?title=${encodeURIComponent(keyword)}&limit=20&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`;
  const data = await httpGet(url);
  if (!data || !data.data) return [];
  
  return data.data.map(item => {
    let title = "Unknown";
    if (item.attributes && item.attributes.title) {
      title = item.attributes.title.en || Object.values(item.attributes.title)[0] || "Unknown";
    }
    let cover = "";
    const coverRel = (item.relationships || []).find(r => r.type === "cover_art");
    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
      cover = `https://uploads.mangadex.org/covers/${item.id}/${coverRel.attributes.fileName}.256.jpg`;
    }
    return {
      id: item.id,
      href: item.id,
      title: title,
      image: cover
    };
  });
}

// 2. Manga details
async function extractDetails(id) {
  const url = `https://api.mangadex.org/manga/${id}?includes[]=cover_art`;
  const data = await httpGet(url);
  if (!data || !data.data) return {};
  
  const item = data.data;
  let title = "Unknown";
  if (item.attributes && item.attributes.title) {
    title = item.attributes.title.en || Object.values(item.attributes.title)[0] || "Unknown";
  }
  let desc = "";
  if (item.attributes && item.attributes.description) {
    desc = item.attributes.description.en || Object.values(item.attributes.description)[0] || "";
  }
  let cover = "";
  const coverRel = (item.relationships || []).find(r => r.type === "cover_art");
  if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
    cover = `https://uploads.mangadex.org/covers/${item.id}/${coverRel.attributes.fileName}.512.jpg`;
  }
  return {
    title: title,
    description: desc,
    image: cover,
    status: item.attributes ? item.attributes.status : ""
  };
}

// 3. Chapter list
async function extractChapters(id) {
  const url = `https://api.mangadex.org/manga/${id}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=100`;
  const data = await httpGet(url);
  if (!data || !data.data) return [];
  
  return data.data.map(ch => {
    const num = ch.attributes.chapter ? `Chapter ${ch.attributes.chapter}` : "Chapter";
    const name = ch.attributes.title ? `: ${ch.attributes.title}` : "";
    return {
      id: ch.id,
      href: ch.id,
      title: `${num}${name}`
    };
  });
}

// 4. Chapter pages / images
async function extractImages(chapterId) {
  const url = `https://api.mangadex.org/at-home/server/${chapterId}`;
  const data = await httpGet(url);
  if (!data || !data.baseUrl || !data.chapter) return [];
  
  const base = data.baseUrl;
  const hash = data.chapter.hash;
  const files = data.chapter.data || [];
  return files.map(file => `${base}/data/${hash}/${file}`);
}

// Global exports for Sora and Luna compatibility
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractChapters = extractChapters;
globalThis.extractImages = extractImages;
globalThis.searchContent = searchResults;
globalThis.getContentData = extractDetails;
globalThis.getChapters = extractChapters;
globalThis.getChapterImages = extractImages;