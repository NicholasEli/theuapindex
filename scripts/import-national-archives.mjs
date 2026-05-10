import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

const SOURCE_URL = "https://www.archives.gov/research/topics/uaps/photographs";
const OUTPUT_PATH = new URL("../data/national-archives.json", import.meta.url);

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&#8203;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDeterministicUuid(seed) {
  const hex = createHash("md5").update(seed).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function absoluteUrl(url) {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `https://www.archives.gov${url}`;
  }

  return url;
}

function cleanTitle(title) {
  return decodeHtml(title)
    .replace(/^Enlarge\s+/i, "")
    .replace(/\s*\(?National Archives Identifier:?\s*\d+\s*\)?\.?$/i, "")
    .replace(/\s*\(\s*$/g, "")
    .replace(/^Series:\s*/i, "")
    .replace(/^[\u200B-\u200D\uFEFF]+/, "")
    .trim();
}

function buildDescription(recordGroup, series, title, identifier) {
  const parts = [
    "National Archives UAP photographs collection.",
    recordGroup ? `Record group: ${recordGroup}.` : "",
    series ? `Series: ${series}.` : "",
    title ? `Catalog title: ${title}.` : "",
    identifier ? `National Archives Identifier: ${identifier}.` : "",
  ];

  return parts.filter(Boolean).join(" ");
}

function getSeriesAt(markers, position) {
  let current = "";

  for (const marker of markers) {
    if (marker.index > position) {
      break;
    }

    current = marker.text;
  }

  return current;
}

function upsertRecord(recordMap, payload) {
  const existing = recordMap.get(payload.catalog_id) ?? {};
  recordMap.set(payload.catalog_id, {
    ...existing,
    ...payload,
    media_url: payload.media_url || existing.media_url || "",
  });
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  const html = await response.text();
  const modifiedMatch = html.match(/article:modified_time" content="([^"]+)"/i);
  const modifiedDate = modifiedMatch ? modifiedMatch[1].slice(0, 10) : "";

  const bodyMatch = html.match(
    /<h2>List of Photographic[\s\S]*?<a id="contact" name="contact"><\/a>/i
  );
  if (!bodyMatch) {
    throw new Error("Could not locate National Archives photographs section");
  }

  const body = bodyMatch[0];
  const groupRegex = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi;
  const recordsById = new Map();

  for (const match of body.matchAll(groupRegex)) {
    const recordGroup = decodeHtml(match[1]).replace(/^[^A-Za-z0-9]+/, "");
    const chunk = match[2];
    const seriesMarkers = [];

    const seriesParagraphRegex = /<p>\s*Items from the series:\s*([\s\S]*?)<\/p>/gi;
    for (const seriesMatch of chunk.matchAll(seriesParagraphRegex)) {
      seriesMarkers.push({
        index: seriesMatch.index ?? 0,
        text: decodeHtml(seriesMatch[1]),
      });
    }

    const seriesLinkRegex =
      /<td>\s*<a href="https:\/\/catalog\.archives\.gov\/id\/(\d+)">([\s\S]*?)<\/a>\)?\s*<\/td>/gi;
    for (const seriesLink of chunk.matchAll(seriesLinkRegex)) {
      const title = cleanTitle(seriesLink[2]);
      seriesMarkers.push({
        index: seriesLink.index ?? 0,
        text: title,
      });

      upsertRecord(recordsById, {
        uuid: formatDeterministicUuid(`national-archives-${seriesLink[1]}`),
        file_name: title,
        release_version: "national-archives-photographs",
        release_date: modifiedDate,
        agency: "National Archives and Records Administration (NARA)",
        incident_date: "N/A",
        incident_location: "N/A",
        description: buildDescription(recordGroup, title, title, seriesLink[1]),
        official_url: `https://catalog.archives.gov/id/${seriesLink[1]}`,
        media_url: "",
        record_group: recordGroup,
        catalog_id: seriesLink[1],
        series: title,
        source_page: SOURCE_URL,
      });
    }

    seriesMarkers.sort((left, right) => left.index - right.index);

    const catalogLinkRegex = /<a href="https:\/\/catalog\.archives\.gov\/id\/(\d+)">([\s\S]*?)<\/a>/gi;
    for (const linkMatch of chunk.matchAll(catalogLinkRegex)) {
      const catalogId = linkMatch[1];
      const rawTitle = decodeHtml(linkMatch[2]);
      const title = cleanTitle(rawTitle);
      const series = getSeriesAt(seriesMarkers, linkMatch.index ?? 0);

      if (!title || rawTitle.startsWith("National Archives Identifier:")) {
        continue;
      }

      upsertRecord(recordsById, {
        uuid: formatDeterministicUuid(`national-archives-${catalogId}`),
        file_name: title,
        release_version: "national-archives-photographs",
        release_date: modifiedDate,
        agency: "National Archives and Records Administration (NARA)",
        incident_date: "N/A",
        incident_location: "N/A",
        description: buildDescription(recordGroup, series, title, catalogId),
        official_url: `https://catalog.archives.gov/id/${catalogId}`,
        record_group: recordGroup,
        catalog_id: catalogId,
        series,
        source_page: SOURCE_URL,
      });
    }

    const featuredRegex =
      /data-caption-body="([^"]+)"[\s\S]*?data-image="([^"]+)"[\s\S]*?<a href="https:\/\/catalog\.archives\.gov\/id\/(\d+)">/gi;
    for (const featuredMatch of chunk.matchAll(featuredRegex)) {
      const catalogId = featuredMatch[3];
      const title = cleanTitle(featuredMatch[1]);
      const series = getSeriesAt(seriesMarkers, featuredMatch.index ?? 0);

      upsertRecord(recordsById, {
        uuid: formatDeterministicUuid(`national-archives-${catalogId}`),
        file_name: title,
        release_version: "national-archives-photographs",
        release_date: modifiedDate,
        agency: "National Archives and Records Administration (NARA)",
        incident_date: "N/A",
        incident_location: "N/A",
        description: buildDescription(recordGroup, series, title, catalogId),
        official_url: `https://catalog.archives.gov/id/${catalogId}`,
        media_url: absoluteUrl(featuredMatch[2]),
        record_group: recordGroup,
        catalog_id: catalogId,
        series,
        source_page: SOURCE_URL,
      });
    }
  }

  const records = [...recordsById.values()]
    .sort((left, right) => Number(left.catalog_id) - Number(right.catalog_id))
    .map((record) => ({
      uuid: record.uuid,
      file_name: record.file_name,
      release_version: record.release_version,
      release_date: record.release_date,
      agency: record.agency,
      incident_date: record.incident_date,
      incident_location: record.incident_location,
      description: record.description,
      official_url: record.official_url,
      media_url: record.media_url,
      record_group: record.record_group,
      catalog_id: record.catalog_id,
      series: record.series,
      source_page: record.source_page,
      debunkers: [],
    }));

  await writeFile(OUTPUT_PATH, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  console.log(`Wrote ${records.length} National Archives records to ${OUTPUT_PATH.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
