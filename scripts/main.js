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
        />
      `;
    }

    if (isVideoExtension(extension)) {
      return `
        <video class="media-card-video" preload="metadata" muted playsinline>
          <source src="${escapeHtml(record.official_url)}" />
        </video>
      `;
    }

    return "";
  }

  function renderMediaCard(record) {
    const detailHref = `release.html?version=${encodeURIComponent(
      record.release_version
    )}&id=${encodeURIComponent(record.uuid)}`;

    return `
      <a class="media-card" href="${detailHref}">
        <div class="media-card-preview">
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
      </a>
    `;
  }

  function renderRecord(record) {
    const metaMarkup = fields
      .map(([label, key]) => renderMeta(label, record[key]))
      .join("");
    const detailHref = `release.html?version=${encodeURIComponent(
      record.release_version
    )}&id=${encodeURIComponent(record.uuid)}`;

    return `
      <div class="cell">
        <a class="record-link" href="${detailHref}">
          <article class="callout record-card">
            <h3 class="record-file">${escapeHtml(record.file_name)}</h3>
            <div class="record-meta">
              ${metaMarkup}
            </div>
            <p class="record-description">${escapeHtml(record.description)}</p>
          </article>
        </a>
      </div>
    `;
  }

  function matchesFilter(record, query) {
    if (!query) {
      return true;
    }

    const haystack = [
      record.file_name,
      record.release_version,
      record.agency,
      record.release_date,
      record.incident_date,
      record.incident_location,
      record.description,
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
    const filteredRecords = allRecords.filter((record) => matchesFilter(record, query));
    renderRecords(filteredRecords);
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
  mediaPrev.addEventListener("click", () => {
    mediaCarousel.scrollBy({ left: -420, behavior: "smooth" });
  });
  mediaNext.addEventListener("click", () => {
    mediaCarousel.scrollBy({ left: 420, behavior: "smooth" });
  });
  loadRecords();
});
