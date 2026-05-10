document.addEventListener("DOMContentLoaded", () => {
  const recordList = document.getElementById("record-list");
  const recordCount = document.getElementById("record-count");
  const recordFilter = document.getElementById("record-filter");
  const recordCountLabel = document.querySelector(".record-count-label");
  const mediaCarousel = document.getElementById("media-carousel");
  const mediaPrev = document.getElementById("media-prev");
  const mediaNext = document.getElementById("media-next");

  let allRecords = [];

  const fields = [
    ["Record Group", "record_group"],
    ["Series", "series"],
    ["Catalog ID", "catalog_id"],
    ["Release Date", "release_date"],
    ["Agency", "agency"],
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

  function getMediaExtension(record) {
    const source = String(record.media_url || "");
    const base = source.split("?")[0];
    const extension = base.split(".").pop();
    return extension ? extension.toLowerCase() : "";
  }

  function isImageExtension(extension) {
    return ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(extension);
  }

  function isVideoExtension(extension) {
    return ["mp4", "webm", "ogg", "mov", "m4v"].includes(extension);
  }

  function isMediaRecord(record) {
    if (!record.media_url) {
      return false;
    }

    const extension = getMediaExtension(record);
    return isImageExtension(extension) || isVideoExtension(extension);
  }

  function renderMediaPreview(record) {
    const extension = getMediaExtension(record);

    if (isImageExtension(extension)) {
      return `
        <img
          class="media-card-image"
          src="${escapeHtml(record.media_url)}"
          alt="${escapeHtml(record.file_name)}"
          loading="lazy"
        />
      `;
    }

    if (isVideoExtension(extension)) {
      return `
        <video class="media-card-video" preload="metadata" muted playsinline>
          <source src="${escapeHtml(record.media_url)}" />
        </video>
      `;
    }

    return "";
  }

  function renderMediaCard(record) {
    return `
      <article
        class="callout media-card media-card-link"
        data-href="${escapeHtml(record.official_url)}"
        data-new-tab="true"
        role="link"
        tabindex="0"
      >
        <div class="media-card-preview">
          ${renderMediaPreview(record)}
        </div>
        <div class="media-card-body">
          <h3 class="media-card-file">${escapeHtml(record.file_name)}</h3>
          <div class="media-card-meta">
            ${renderMeta("Record Group", record.record_group)}
            ${renderMeta("Catalog ID", record.catalog_id)}
          </div>
          <p class="media-card-description">${escapeHtml(record.description)}</p>
        </div>
      </article>
    `;
  }

  function renderRecord(record) {
    const metaMarkup = fields.map(([label, key]) => renderMeta(label, record[key])).join("");
    const previewMarkup = isMediaRecord(record)
      ? `
        <div class="record-card-preview">
          ${renderMediaPreview(record)}
        </div>
      `
      : "";

    return `
      <div class="cell">
        <article
          class="callout record-card record-card-link"
          data-href="${escapeHtml(record.official_url)}"
          data-new-tab="true"
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

  function matchesFilter(record, query) {
    if (!query) {
      return true;
    }

    const haystack = [
      record.uuid,
      record.file_name,
      record.record_group,
      record.series,
      record.catalog_id,
      record.agency,
      record.description,
      record.release_version,
      ...buildDateTokens(record.release_date),
      record.official_url,
      record.source_page,
      isMediaRecord(record) ? "image photo media photograph archives nara" : "catalog record",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
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
          No featured National Archives images are available in this dataset.
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
    renderRecords(allRecords.filter((record) => matchesFilter(record, query)));
  }

  function navigateCard(card) {
    if (!card?.dataset.href) {
      return;
    }

    if (card.dataset.newTab === "true") {
      window.open(card.dataset.href, "_blank", "noopener");
      return;
    }

    window.location.href = card.dataset.href;
  }

  function handleCardNavigation(event, selector) {
    const card = event.target.closest(selector);
    if (card) {
      navigateCard(card);
    }
  }

  function handleCardKeydown(event, selector) {
    const card = event.target.closest(selector);
    if (!card?.dataset.href) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateCard(card);
    }
  }

  async function loadRecords() {
    try {
      const response = await fetch("data/national-archives.json");
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      allRecords = await response.json();
      renderMediaCarousel(allRecords);
      renderRecords(allRecords);
    } catch (error) {
      recordCountLabel.textContent = "Error";
      recordCount.textContent = "0";
      recordList.innerHTML = "";
      mediaCarousel.innerHTML = `
        <div class="callout status-message is-error">
          Unable to load National Archives records.
        </div>
      `;
      mediaPrev.disabled = true;
      mediaNext.disabled = true;
      console.error(error);
    }
  }

  recordFilter.addEventListener("input", applyFilter);
  recordList.addEventListener("click", (event) => handleCardNavigation(event, ".record-card-link"));
  recordList.addEventListener("keydown", (event) => handleCardKeydown(event, ".record-card-link"));
  mediaCarousel.addEventListener("click", (event) => handleCardNavigation(event, ".media-card-link"));
  mediaCarousel.addEventListener("keydown", (event) => handleCardKeydown(event, ".media-card-link"));
  mediaPrev.addEventListener("click", () => {
    mediaCarousel.scrollBy({ left: -420, behavior: "smooth" });
  });
  mediaNext.addEventListener("click", () => {
    mediaCarousel.scrollBy({ left: 420, behavior: "smooth" });
  });

  loadRecords();
});
