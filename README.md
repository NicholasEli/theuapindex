# Open UAP Index

Open UAP Index is a static GitHub Pages project for publishing, organizing, and browsing public UAP/UFO records.

The current site has two main sections:
- `Release 01`: the first public release in the current government UAP/UFO disclosure effort
- `National Archives`: a separate index built from the National Archives UAP photographs page

The project is intentionally simple:
- plain HTML pages
- one shared CSS file
- small page-specific JavaScript files
- JSON datasets stored in-repo
- no build step required for the live site

## Project Structure

```text
.
├── assets/
│   └── uap-bg.webp
├── data/
│   ├── national-archives.json
│   └── release-01.json
├── schema/
│   └── record.json
├── scripts/
│   ├── import-national-archives.mjs
│   ├── import-release-01.mjs
│   ├── main.js
│   ├── national-archives.js
│   └── release.js
├── styles/
│   └── main.css
├── CNAME
├── index.html
├── national-archives.html
├── record.html
└── release.html
```

## How The Site Works

### `index.html`

The main release landing page.

It includes:
- a header and primary nav
- a featured media carousel
- a filterable record grid
- client-side loading of `data/release-01.json`

The page logic lives in `scripts/main.js`.

### `release.html`

The per-record detail page.

It loads a record from a dataset using query parameters:

```text
release.html?version=release-01&id=<uuid>
```

The page logic lives in `scripts/release.js`.

### `record.html`

Compatibility redirect for older links. It forwards to `release.html`.

### `national-archives.html`

A separate section for National Archives UAP photograph records.

It mirrors the same broad pattern as the home page:
- hero/header
- featured media carousel
- filter input
- record grid

The page logic lives in `scripts/national-archives.js`.

## Data Files

### `data/release-01.json`

The primary release dataset.

Current dataset size:
- `161` records

The records generally follow `schema/record.json`.

Core fields:
- `uuid`
- `description`
- `file_name`
- `release_date`
- `release_version`
- `agency`
- `incident_date`
- `incident_location`
- `official_url`
- optional `debunkers`

### `data/national-archives.json`

National Archives-specific dataset generated from:
- [archives.gov/research/topics/uaps/photographs](https://www.archives.gov/research/topics/uaps/photographs)

Current dataset size:
- `86` records

This dataset extends beyond the base record schema and also includes:
- `media_url`
- `record_group`
- `catalog_id`
- `series`
- `source_page`

## Schema

`schema/record.json` defines the base release-record contract used by `release-01.json`.

If you branch this project and introduce new record families, decide early whether you want:
- one shared base schema plus per-source extensions
- or separate schemas for each source

Right now the National Archives dataset is a practical extension of the base model rather than a fully separate schema.

## Media And File Strategy

This repo does not store the large source files locally.

Instead:
- the UI uses `official_url` for Release 01 assets
- the National Archives section uses `official_url` for catalog records and `media_url` for preview images where available

This keeps the repo GitHub Pages-friendly and avoids large binary storage problems.

## Debunkers

Some release records may include a `debunkers` array:

```json
[
  {
    "name": "Example Researcher",
    "url": "https://example.com/source"
  }
]
```

Current UI behavior:
- on `index.html`, tags are shown as `Debunked`
- on `release.html`, the actual debunker names are shown
- debunker names and URLs are included in filtering

## Running Locally

Because the pages fetch local JSON, use a local HTTP server instead of opening the HTML files directly.

Example:

```bash
python3 -m http.server 8123
```

Then open:

```text
http://127.0.0.1:8123/
```

## Updating Data

### Refresh Release 01

The release importer is:

```bash
node scripts/import-release-01.mjs
```

Review the output before committing. This project has been moving quickly, and the release source may change shape over time.

### Refresh National Archives

The National Archives importer is:

```bash
node scripts/import-national-archives.mjs
```

That script currently targets:
- [archives.gov/research/topics/uaps/photographs](https://www.archives.gov/research/topics/uaps/photographs)

If the Archives page structure changes, the scraper will likely need maintenance.

## Branching This Project

If you fork or branch this project for another disclosure archive, the easiest path is:

1. Keep the static structure.
2. Add a new dataset under `data/`.
3. Add a dedicated page and page script for that dataset.
4. Reuse `styles/main.css` unless you want a different visual system.
5. Keep `official_url` as the source of truth for external files whenever possible.

Good candidates for expansion:
- additional numbered releases
- FOIA collections
- National Archives sub-pages
- agency-specific sections
- cross-source search or tagging

## GitHub Pages Notes

This repository is designed to work well with GitHub Pages:
- static HTML entrypoints
- no runtime backend
- no local file storage dependency
- custom domain supported through `CNAME`

If you change the deployment domain, also update:
- canonical URLs
- Open Graph URLs
- Twitter image/page URLs

## Recommended Next Improvements

- move metadata URLs from the GitHub Pages domain to the custom domain everywhere
- add source-specific schemas for non-release datasets
- add shared utilities so page scripts stop duplicating rendering/filter logic
- add a simple validation script for JSON datasets before deploy
- add pagination or virtualized rendering if datasets grow significantly
