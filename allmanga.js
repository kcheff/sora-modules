/**
 * AllManga Module for Sora by kcheff
 */

const API_ENDPOINTS = [
  "https://api.allanime.day/api",
  "https://api.mkissa.net/api"
];

// Helper to query AllAnime / AllManga GraphQL backend via GET
async function sendGraphQL(query, variables) {
  const headers = {
    "Referer": "https://allmanga.to",
    "Origin": "https://allmanga.to",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };

  const cleanQuery = query.replace(/\s+/g, " ").trim();
  const varsString = JSON.stringify(variables);

  for (const endpoint of API_ENDPOINTS) {
    try {
      const url = `${endpoint}?variables=${encodeURIComponent(varsString)}&query=${encodeURIComponent(cleanQuery)}`;
      const res = await fetchv2(url, headers, "GET", null);
      
      let data = res;
      if (typeof res === "string") {
        try { data = JSON.parse(res); } catch (_) { continue; }
      } else if (res && typeof res.json === "function") {
        data = await res.json();
      }
      
      if (data && data.data) return data.data;
    } catch (e) {
      // Fall through to next endpoint
    }
  }
  return null;
}

// 1. Search Manga (queries 'shows' with isManga: true)
async function searchResults(keyword) {
  const query = `
    query ($search: SearchInput, $limit: Int, $page: Int, $translationType: VaildTranslationTypeEnumType, $countryOrigin: VaildCountryEnumType) {
      shows(search: $search, limit: $limit, page: $page, translationType: $translationType, countryOrigin: $countryOrigin) {
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
      isManga: true,
      query: keyword
    },
    limit: 26,
    page: 1,
    translationType: "sub",
    countryOrigin: "ALL"
  };

  const data = await sendGraphQL(query, variables);
  if (!data || !data.shows || !data.shows.edges) return [];

  return data.shows.edges.map(edge => {
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

// 2. Manga details
async function extractDetails(id) {
  const query = `
    query ($showId: String!) {
      show(_id: $showId) {
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
  if (!data || !data.show) return {};

  const m = data.show;
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

// 3. Manga chapter list
async function extractChapters(id) {
  const query = `
    query ($showId: String!) {
      show(_id: $showId) {
        availableChaptersDetail
      }
    }
  `;

  const data = await sendGraphQL(query, { showId: id });
  if (!data || !data.show || !data.show.availableChaptersDetail) return [];

  const chaptersObj = data.show.availableChaptersDetail;
  const subChapters = chaptersObj.sub || chaptersObj.raw || [];

  return subChapters.map(ch => ({
    id: `${id}:${ch}`,
    href: `${id}:${ch}`,
    title: `Chapter ${ch}`
  }));
}

// 4. Chapter pages
async function extractImages(chapterIdentifier) {
  const [showId, chapterNum] = chapterIdentifier.split(":");
  if (!showId || !chapterNum) return [];

  const query = `
    query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
      episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) {
        sourceUrls
      }
    }
  `;

  const variables = {
    showId: showId,
    translationType: "sub",
    episodeString: chapterNum
  };

  const data = await sendGraphQL(query, variables);
  if (!data || !data.episode || !data.episode.sourceUrls) return [];

  return data.episode.sourceUrls.map(item => {
    let url = item.sourceUrl || item.url || "";
    if (url && !url.startsWith("http")) {
      url = "https://wp.allanime.day" + (url.startsWith("/") ? "" : "/") + url;
    }
    return url;
  }).filter(Boolean);
}

// Global exports for Sora compatibility
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractChapters = extractChapters;
globalThis.extractImages = extractImages;

globalThis.searchContent = searchResults;
globalThis.getContentData = extractDetails;
globalThis.getChapters = extractChapters;
globalThis.getChapterImages = extractImages;