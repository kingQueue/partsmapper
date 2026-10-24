# Partsmapper / Partmap Hardware Studio

A browser-based hardware product mapper with an editable component tree, a parts checklist, and a pin-to-pin wiring view.

[Open the hosted app](https://partmap-hardware-studio.dewylamp260.chatgpt.site/) (owner access required).

## Run locally

Requires Node.js 18 or newer. No dependency installation or build is needed.

```sh
npm start
```

Open http://127.0.0.1:4173 in your browser. Stop the server with Ctrl+C.

Alternatively, serve the `dist/` folder with a static HTTP server.

## Check the app

```sh
npm test
```

The checks cover tree validation, import parsing, baseline changes, pin inventories, wiring, and firmware exports. They use a lightweight DOM stub; they are not a complete browser test suite.

## Features

- Nested component trees with full product and electronics-only views.
- Parts readiness checklist for electronics, motors, printed parts, and fasteners.
- CSV, TXT, pasted-list, and JSON imports with a preview and append/replace options.
- Board-style wiring view, editable pins, and explicit pin-to-pin connections.
- Reference file attachments and component specifications.
- JSON backups and Markdown briefs for an AI coding assistant, including changes since a baseline.

Projects and attachments are saved in browser local storage. This repository contains application code and example data; it does not synchronize your personal project data. Export a Project JSON backup to move a project between browsers, origins, or devices. Local and hosted instances have separate browser storage.

See [the user guide](dist/README.md) for import formats and limitations. The wiring cards are logical representations, not manufacturer-specific physical pinouts. Specifications and wiring must be supplied and verified by the user.

## Source layout

- `dist/index.html`: app structure and dialogs
- `dist/style.css`: layout and styles
- `dist/app.js`: component tree, checklist, persistence, and exports
- `dist/studio.js`: pin inventories, wiring view, and parts-list import preview
- `dist/example-parts.csv`, `dist/example-parts.txt`: import examples
- `preview.cjs`: local static server
- `check.cjs`, `check-studio.cjs`: verification scripts

Deploy the `dist/` folder to a static host. This repository is a source copy; pushing here does not automatically update the hosted Sites app.
