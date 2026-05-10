document.addEventListener("DOMContentLoaded", () => {
  const recordList = document.getElementById("record-list");
  const recordCount = document.getElementById("record-count");
  const recordFilter = document.getElementById("record-filter");
  const debunkedOnlyToggle = document.getElementById("debunked-only");
  const recordCountLabel = document.querySelector(".record-count-label");
  const mediaCarousel = document.getElementById("media-carousel");
  const mediaPrev = document.getElementById("media-prev");
  const mediaNext = document.getElementById("media-next");

  let allRecords = [];

  const fields = [
    ["Release Version", "release_version"],
    ["Release Agency", "agency"],
    ["Release Date", "release_date"],
    ["Incident Date", "incident_date"],
    ["Incident Location", "incident_location"],
  ];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character];
    });
  }

  function renderMeta(label, value) {
    return `
      <div class="record-meta-block">
        <p class="record-meta-label">${escapeHtml(label)}</p>
        <p class="record-meta-value">${escapeHtml(value || "N/A")}</p>
      </div>
    `;
  }

  function renderDebunkerTags(record) {
    if (!Array.isArray(record.debunkers) || !record.debunkers.length) {
      return "";
    }

    return `
      <div class="record-tag-list preview-tag-list">
        ${record.debunkers
          .map(
            (debunker) => `
              <a
                class="record-tag"
                href="${escapeHtml(debunker.url)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Debunked
              </a>
            `
          )
          .join("")}
      </div>
    `;
  }

  function getFileExtension(record) {
    const fromFileName = String(record.file_name || "").split(".").pop();
    return fromFileName ? fromFileName.toLowerCase() : "";
  }

  function isImageExtension(extension) {
    return ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(extension);
  }

  function isVideoExtension(extension) {
    return ["mp4", "webm", "ogg", "mov", "m4v"].includes(extension);
  }

  function isMediaRecord(record) {
    const extension = getFileExtension(record);
    return isImageExtension(extension) || isVideoExtension(extension);
  }

  function renderMediaPreview(record) {
    const extension = getFileExtension(record);

    if (isImageExtension(extension)) {
      return `
        <img
          class="media-card-image"
          src="${escapeHtml(record.official_url)}"
          alt="${escapeHtml(record.file_name)}"
          loading="lazy"
          decoding="async"
        />
      `;
    }

    if (isVideoExtension(extension)) {
      return `
        <div class="video-shell is-loading">
          <div class="video-spinner" aria-hidden="true"></div>
          <video class="media-card-video" muted playsinline>
            <source src="${escapeHtml(record.official_url)}" />
          </video>
        </div>
      `;
    }

    return "";
  }

  function renderMediaCard(record) {
    const detailHref = `release.html?version=${encodeURIComponent(
      record.release_version
    )}&id=${encodeURIComponent(record.uuid)}`;

    return `
      <article
        class="callout media-card media-card-link"
        data-href="${detailHref}"
        role="link"
        tabindex="0"
      >
        <div class="media-card-preview">
          ${renderDebunkerTags(record)}
          ${renderMediaPreview(record)}
        </div>
        <div class="media-card-body">
          <h3 class="media-card-file">${escapeHtml(record.file_name)}</h3>
          <div class="media-card-meta">
            ${renderMeta("Release Date", record.release_date)}
            ${renderMeta("Incident Date", record.incident_date)}
          </div>
          <p class="media-card-description">${escapeHtml(record.description)}</p>
        </div>
      </article>
    `;
  }

  function renderRecord(record) {
    const metaMarkup = fields
      .map(([label, key]) => renderMeta(label, record[key]))
      .join("");
    const detailHref = `release.html?version=${encodeURIComponent(
      record.release_version
    )}&id=${encodeURIComponent(record.uuid)}`;
    const hasDebunkers = Array.isArray(record.debunkers) && record.debunkers.length > 0;
    const hasRecordPreview = isMediaRecord(record) || hasDebunkers;
    const previewMarkup = hasRecordPreview
      ? `
        <div class="record-card-preview">
          ${renderDebunkerTags(record)}
          ${renderMediaPreview(record)}
        </div>
      `
      : "";

    return `
      <div class="cell">
          <article
            class="callout record-card record-card-link"
            data-href="${detailHref}"
            role="link"
            tabindex="0"
          >
            ${previewMarkup}
            <h3 class="record-file">${escapeHtml(record.file_name)}</h3>
            <div class="record-meta">
              ${metaMarkup}
            </div>
            <p class="record-description">${escapeHtml(record.description)}</p>
          </article>
      </div>
    `;
  }

  function buildDateTokens(value) {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
      return [];
    }

    const tokens = [normalized];
    const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      tokens.push(isoMatch[1], `${isoMatch[1]}-${isoMatch[2]}`);
    }

    return tokens;
  }

  function buildFileTypeTokens(record) {
    const extension = getFileExtension(record);
    if (!extension) {
      return [];
    }

    const tokens = [extension];
    if (extension === "pdf") {
      tokens.push("document");
    }
    if (["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(extension)) {
      tokens.push("image", "photo", "media");
    }
    if (["mp4", "webm", "ogg", "mov", "m4v"].includes(extension)) {
      tokens.push("video", "media", "non-pdf");
    }

    return tokens;
  }

  function buildSynonymTokens(record) {
    const tokens = ["uap", "ufo"];
    const agency = String(record.agency ?? "").toLowerCase();
    const description = String(record.description ?? "").toLowerCase();

    if (agency.includes("department of war")) {
      tokens.push("dod", "dow");
    }
    if (agency.includes("fbi")) {
      tokens.push("federal bureau of investigation");
    }
    if (description.includes("infrared")) {
      tokens.push("ir");
    }
    if (Array.isArray(record.debunkers) && record.debunkers.length) {
      tokens.push("debunked", "debunker");
    }
    if (isMediaRecord(record)) {
      tokens.push("media");
    }

    return tokens;
  }

  function matchesFilter(record, query) {
    if (!query) {
      return true;
    }

    const haystack = [
      record.uuid,
      record.file_name,
      record.release_version,
      record.agency,
      ...buildDateTokens(record.release_date),
      ...buildDateTokens(record.incident_date),
      record.incident_location,
      record.description,
      ...buildFileTypeTokens(record),
      ...buildSynonymTokens(record),
      ...(Array.isArray(record.debunkers)
        ? record.debunkers.flatMap((debunker) => [debunker.name, debunker.url])
        : []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  }

  function hasDebunkers(record) {
    return Array.isArray(record.debunkers) && record.debunkers.length > 0;
  }

  function renderRecords(records) {
    recordCount.textContent = String(records.length);
    recordCountLabel.textContent = recordFilter.value.trim() ? "Matching" : "Loaded";

    if (!records.length) {
      recordList.innerHTML = `
        <div class="cell">
          <div class="callout status-message is-empty">
            No records match the current filter.
          </div>
        </div>
      `;
      return;
    }

    recordList.innerHTML = records.map(renderRecord).join("");
  }

  function renderMediaCarousel(records) {
    const mediaRecords = records.filter((record) => isMediaRecord(record));

    if (!mediaRecords.length) {
      mediaCarousel.innerHTML = `
        <div class="callout status-message is-empty">
          No image or video records are available in this release.
        </div>
      `;
      mediaPrev.disabled = true;
      mediaNext.disabled = true;
      return;
    }

    mediaCarousel.innerHTML = mediaRecords.map(renderMediaCard).join("");
    mediaPrev.disabled = false;
    mediaNext.disabled = false;
  }

  function applyFilter() {
    const query = recordFilter.value.trim().toLowerCase();
    const debunkedOnly = debunkedOnlyToggle?.checked;
    const filteredRecords = allRecords.filter((record) => {
      if (debunkedOnly && !hasDebunkers(record)) {
        return false;
      }

      return matchesFilter(record, query);
    });
    renderRecords(filteredRecords);
  }

  function initializeVideoLoading(scope = document) {
    const videos = scope.querySelectorAll(".video-shell video");
    for (const video of videos) {
      const shell = video.closest(".video-shell");
      if (!shell || video.dataset.loadingBound === "true") {
        continue;
      }

      video.dataset.loadingBound = "true";
      const resolveLoading = () => {
        shell.classList.remove("is-loading");
      };

      if (video.readyState >= 2) {
        resolveLoading();
        continue;
      }

      video.addEventListener("loadeddata", resolveLoading, { once: true });
      video.addEventListener("error", resolveLoading, { once: true });
    }
  }

  async function loadRecords() {
    try {
      const response = await fetch("data/release-01.json");
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      allRecords = await response.json();
      renderMediaCarousel(allRecords);
      renderRecords(allRecords);
      initializeVideoLoading(recordList);
      initializeVideoLoading(mediaCarousel);
    } catch (error) {
      recordCountLabel.textContent = "Error";
      recordCount.textContent = "0";
      recordList.innerHTML = "";
      mediaCarousel.innerHTML = `
        <div class="callout status-message is-error">
          Unable to load media records.
        </div>
      `;
      mediaPrev.disabled = true;
      mediaNext.disabled = true;
      console.error(error);
    }
  }

  recordFilter.addEventListener("input", applyFilter);
  debunkedOnlyToggle?.addEventListener("change", applyFilter);
  function handleCardNavigation(event, selector) {
    const tagLink = event.target.closest(".record-tag");
    if (tagLink) {
      event.stopPropagation();
      return;
    }

    const card = event.target.closest(selector);
    if (card?.dataset.href) {
      window.location.href = card.dataset.href;
    }
  }

  function handleCardKeydown(event, selector) {
    const card = event.target.closest(selector);
    if (!card?.dataset.href) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      window.location.href = card.dataset.href;
    }
  }

  recordList.addEventListener("click", (event) => {
    handleCardNavigation(event, ".record-card-link");
  });
  recordList.addEventListener("keydown", (event) => {
    handleCardKeydown(event, ".record-card-link");
  });
  mediaCarousel.addEventListener("click", (event) => {
    handleCardNavigation(event, ".media-card-link");
  });
  mediaCarousel.addEventListener("keydown", (event) => {
    handleCardKeydown(event, ".media-card-link");
  });
  mediaPrev.addEventListener("click", () => {
    mediaCarousel.scrollBy({ left: -420, behavior: "smooth" });
  });
  mediaNext.addEventListener("click", () => {
    mediaCarousel.scrollBy({ left: 420, behavior: "smooth" });
  });
  loadRecords();
});
