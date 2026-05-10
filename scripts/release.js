document.addEventListener("DOMContentLoaded", () => {
  const detailStatus = document.getElementById("detail-status");
  const detailView = document.getElementById("detail-view");
  const detailVersionKicker = document.getElementById("detail-version-kicker");
  const detailFileName = document.getElementById("detail-file-name");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");
  const detailPreview = document.getElementById("detail-preview");

  const params = new URLSearchParams(window.location.search);
  const version = params.get("version");
  const id = params.get("id");

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

  function setError(message) {
    detailStatus.textContent = message;
    detailStatus.classList.add("is-error");
    detailView.hidden = true;
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

  function renderMeta(label, value, asLink = false) {
    const renderedValue = asLink
      ? `<a class="detail-meta-link" href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`
      : escapeHtml(value || "N/A");

    return `
      <div class="detail-meta-item">
        <p class="record-meta-label">${escapeHtml(label)}</p>
        <p class="record-meta-value">${renderedValue}</p>
      </div>
    `;
  }

  function renderPreview(record) {
    const extension = getFileExtension(record);
    const url = record.official_url;

    if (isImageExtension(extension)) {
      return `
        <figure class="detail-preview-card">
          <img
            class="detail-image"
            src="${escapeHtml(url)}"
            alt="${escapeHtml(record.file_name)}"
          />
        </figure>
      `;
    }

    if (isVideoExtension(extension)) {
      return `
        <div class="detail-preview-card">
          <video class="detail-video" controls preload="metadata">
            <source src="${escapeHtml(url)}" />
            Your browser does not support embedded video playback.
          </video>
        </div>
      `;
    }

    return `
      <div class="detail-link-card">
        <p class="detail-link-copy">
          This file type is not embedded in the page preview.
        </p>
        <a
          class="button expanded detail-open-button"
          href="${escapeHtml(url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Source File
        </a>
      </div>
    `;
  }

  async function loadRecord() {
    if (!version || !id) {
      setError("Missing release version or record id.");
      return;
    }

    try {
      const response = await fetch(`data/${version}.json`);
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const records = await response.json();
      const record = records.find((item) => item.uuid === id);

      if (!record) {
        setError("Record not found for the requested version and id.");
        return;
      }

      document.title = `${record.file_name} | The UAP Index`;
      detailVersionKicker.textContent = record.release_version;
      detailFileName.textContent = record.file_name;
      detailDescription.textContent = record.description;
      detailMeta.innerHTML = [
        renderMeta("UUID", record.uuid),
        renderMeta("Release Version", record.release_version),
        renderMeta("Release Date", record.release_date),
        renderMeta("Agency", record.agency),
        renderMeta("Incident Date", record.incident_date),
        renderMeta("Incident Location", record.incident_location),
        renderMeta("Official URL", record.official_url, true),
      ].join("");
      detailPreview.innerHTML = renderPreview(record);

      detailStatus.hidden = true;
      detailView.hidden = false;
    } catch (error) {
      setError("Unable to load this record.");
      console.error(error);
    }
  }

  loadRecord();
});
