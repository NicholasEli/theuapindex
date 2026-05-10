import fs from "node:fs/promises";
import path from "node:path";

const RELEASE_VERSION = "release-01";
const CSV_URL = "https://www.war.gov/Portals/1/Interactive/2026/UFO/uap-csv.csv";
const DVIDS_API_KEY = "key-68bb60d16b35e";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");
const OUTPUT_JSON = path.join(DATA_DIR, `${RELEASE_VERSION}.json`);

function parseCSV(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === "\"" && insideQuotes && nextChar === "\"") {
      cell += "\"";
      i += 1;
    } else if (char === "\"") {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (cell || row.length) {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
      }

      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

function cleanHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseUsDate(value) {
  const normalized = normalizeWhitespace(value);

  if (!normalized || normalized.toUpperCase() === "N/A") {
    return "N/A";
  }

  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) {
    return normalized;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);

  if (year < 100) {
    const currentTwoDigitYear = new Date().getUTCFullYear() % 100;
    year += year <= currentTwoDigitYear + 1 ? 2000 : 1900;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return date.toISOString().slice(0, 10);
}

function splitPipeList(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fileNameFromUrl(url, fallbackBase) {
  if (!url) {
    return fallbackBase;
  }

  try {
    const parsed = new URL(url);
    const base = path.basename(parsed.pathname);
    return decodeURIComponent(base || fallbackBase);
  } catch {
    return fallbackBase;
  }
}

function safeFileBase(value) {
  return normalizeWhitespace(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "record";
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function resolveVideoAsset(videoId) {
  const apiUrl =
    `https://api.dvidshub.net/asset?api_key=${DVIDS_API_KEY}` +
    `&id=video:${encodeURIComponent(videoId)}&thumb_width=720`;

  const payload = await fetchJson(apiUrl, {
    headers: {
      Referer: "https://www.war.gov/UFO/",
      "User-Agent": "Mozilla/5.0",
    },
  });
  const data = payload.results || payload.data || payload;
  const files = Array.isArray(data.files) ? data.files : [];

  const highestMp4 = files
    .filter((file) => file && file.type === "video/mp4" && file.src)
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

  return {
    assetUrl: highestMp4?.src || data.hls_url || `https://www.dvidshub.net/video/${videoId}`,
    officialUrl: highestMp4?.src || `https://www.dvidshub.net/video/${videoId}`,
  };
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const csvText = await fetchText(CSV_URL);
  const rows = parseCSV(csvText);
  const headers = rows[0].map(cleanHeader);
  const dataRows = rows.slice(1);

  const get = (cols, name) => {
    const index = headers.indexOf(cleanHeader(name));
    return index >= 0 ? cols[index] || "" : "";
  };

  const output = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const cols = dataRows[i];
    const title = normalizeWhitespace(get(cols, "Title"));
    const description = normalizeWhitespace(get(cols, "Description Blurb"));
    const releaseDate = parseUsDate(get(cols, "Release Date"));
    const agency = normalizeWhitespace(get(cols, "Agency"));
    const incidentDate = parseUsDate(get(cols, "Incident Date"));
    const incidentLocation = normalizeWhitespace(get(cols, "Incident Location")) || "N/A";
    const documentUrl = splitPipeList(get(cols, "PDF | Image Link"))[0] || "";
    const imageUrl = splitPipeList(get(cols, "Modal Image"))[0] || "";
    const videoId = splitPipeList(get(cols, "DVIDS Video ID"))[0] || "";

    let assetUrl = documentUrl || imageUrl;
    let officialUrl = assetUrl;

    if (!assetUrl && videoId) {
      const videoAsset = await resolveVideoAsset(videoId);
      assetUrl = videoAsset.assetUrl;
      officialUrl = videoAsset.officialUrl;
    }

    if (!officialUrl) {
      officialUrl = assetUrl;
    }

    const fallbackBase = safeFileBase(title || `record_${String(i + 1).padStart(3, "0")}`);
    const fileName = fileNameFromUrl(assetUrl || officialUrl, fallbackBase);

    output.push({
      description,
      file_name: fileName,
      release_date: releaseDate,
      release_version: RELEASE_VERSION,
      agency,
      incident_date: incidentDate,
      incident_location: incidentLocation,
      official_url: officialUrl,
    });

    console.log(`[${i + 1}/${dataRows.length}] ${fileName}`);
  }

  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${output.length} records to ${OUTPUT_JSON}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
