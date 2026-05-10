# AGENTS.md

This file captures repo-specific guidance for future Codex or agent runs.

## Project Type

- Static site for GitHub Pages
- No build system is required for normal site operation
- Frontend stack is plain HTML, CSS, and JavaScript with Foundation CSS from CDN

## Primary Conventions

- Keep pages static and deployment-friendly
- Prefer simple client-side JSON loading over adding frameworks or build tooling
- Reuse the visual language already established in `styles/main.css`
- Preserve the existing dark theme unless the user asks for a redesign

## Routes And Pages

- `index.html` is the Release 01 landing page
- `release.html` is the detail page for record lookups
- `record.html` is a redirect shim to `release.html`
- `national-archives.html` is a dedicated page for National Archives records

## Data Rules

- `data/release-01.json` is the primary release dataset
- `data/national-archives.json` is a source-specific dataset and contains extra fields beyond the base schema
- `schema/record.json` is the base schema for release-style records
- Do not assume every dataset in `data/` exactly matches `schema/record.json`

## File And Media Rules

- Do not reintroduce a tracked local `files/` directory unless explicitly requested
- Prefer `official_url` for source files
- For National Archives records, use `media_url` only for previews and `official_url` for the canonical record destination
- Large binaries should not be committed into the repo by default

## UI Behavior

- Record cards and featured media are clickable cards, not nested anchor layouts
- On `index.html`, debunker tags intentionally display `Debunked` instead of the actual name
- On `release.html`, actual debunker names should remain visible
- Video previews use a loading spinner until the video can render

## Local Testing

- Use a local HTTP server for testing because pages fetch JSON
- Example: `python3 -m http.server 8123`
- Do not assume `file://` access will behave correctly

## When Editing

- Prefer targeted edits over broad rewrites
- Preserve existing data fields and URLs unless the user requests structural changes
- If modifying import scripts, verify the generated JSON shape afterward
- If changing page metadata, keep canonical/OG/Twitter tags in sync
