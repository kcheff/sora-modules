/**
 * AllManga Module for Sora
 */

const API_ENDPOINTS = [
  "https://api.allanime.day/api",
  "https://api.mkissa.net/api"
];

// Helper to handle Sora's native fetchv2 responses
async function sendGraphQL(query, variables) {
  const payload = JSON.stringify({ query, variables });
  const headers = {
    "Content-Type": "application/json",
    "Referer": "https://allmanga.to",
    "Origin": "https://allmanga.to",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };

  for (const endpoint of API_ENDPOINTS) {
    try {
      const res = await fetchv2(endpoint, headers, "POST", payload);
      let data = res;
      if (typeof res === "string") {
        try { data = JSON.parse(res); } catch (_) { continue; }
      } else if (res && typeof res.json === "function") {
        data = await res.json();
      }
      if (data && data.data) return data.data;
    } catch (e) {
      // Fall through to next mirror
    }
  }
  return null;
}

// 1. Search manga
async function searchResults(keyword) {
  const query = `
    query ($search: SearchInput, $limit: Int, $page: Int, $translationType: VaildTranslationTypeEnumType) {
      mangas(search: $search, limit: $limit, page: $page, translationType: $translationType) {
        edges {
          _id
          name
          thumbnail
          englishName
        }
      }
    }
  `;

  const variables = {
    search: {
      allowAdult: false,
      allowUnknown: false,
      query: keyword
    },
    limit: 26,
    page: 1,
    translationType: "sub"
  };

  const data = await sendGraphQL(query, variables);
  if (!data || !data.mangas || !data.mangas.edges) return [];

  return data.mangas.edges.map(edge => {
    let img = edge.thumbnail || "";
    if (img && !img.startsWith("http")) {
      img = "https://wp.allanime.day" + (img.startsWith("/") ? "" : "/") + img;
    }
    return {
      id: edge._id,
      href: edge._id,
      title: edge.englishName || edge.name || "Unknown",
      image: img
    };
  });
}

// 2. Manga details & chapter count
async function extractDetails(id) {
  const query = `
    query ($showId: String!) {
      manga(showId: $showId) {
        _id
        name
        englishName
        thumbnail
        description
        status
        availableChaptersDetail
      }
    }
  `;

  const data = await sendGraphQL(query, { showId: id });
  if (!data || !data.manga) return {};

  const m = data.manga;
  let img = m.thumbnail || "";
  if (img && !img.startsWith("http")) {
    img = "https://wp.allanime.day" + (img.startsWith("/") ? "" : "/") + img;
  }

  return {
    title: m.englishName || m.name || "Unknown",
    description: m.description || "",
    image: img,
    status: m.status || ""
  };
}

// 3. Extract all chapters
async function extractChapters(id) {
  const query = `
    query ($showId: String!) {
      manga(showId: $showId) {
        availableChaptersDetail
      }
    }
  `;

  const data = await sendGraphQL(query, { showId: id });
  if (!data || !data.manga || !data.manga.availableChaptersDetail) return [];

  const chaptersObj = data.manga.availableChaptersDetail;
  const subChapters = chaptersObj.sub || chaptersObj.raw || [];

  return subChapters.map(ch => ({
    id: `${id}:${ch}`,
    href: `${id}:${ch}`,
    title: `Chapter ${ch}`
  }));
}

// 4. Extract pages for a chapter
async function extractImages(chapterIdentifier) {
  const [mangaId, chapterNum] = chapterIdentifier.split(":");
  if (!mangaId || !chapterNum) return [];

  const query = `
    query ($mangaId: String!, $chapterNum: String!) {
      chapterPages(mangaId: $mangaId, chapterNum: $chapterNum) {
        edges {
          pictureUrl
          pictureUrls
        }
      }
    }
  `;

  const data = await sendGraphQL(query, { mangaId, chapterNum });
  if (!data || !data.chapterPages || !data.chapterPages.edges) return [];

  return data.chapterPages.edges.map(page => {
    let url = page.pictureUrl || (page.pictureUrls && page.pictureUrls[0]) || "";
    if (url && !url.startsWith("http")) {
      url = "https://wp.allanime.day" + (url.startsWith("/") ? "" : "/") + url;
    }
    return url;
  }).filter(Boolean);
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