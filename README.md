# Partsmapper / Partmap Hardware Studio

A browser-based hardware product mapper with an editable component tree, a parts checklist, and a pin-to-pin wiring view.

Run it on your own computer at **http://127.0.0.1:4173**. No account, login, authentication service, or API key is required.

## Run locally

Requires Node.js 18 or newer. No dependency installation or build is needed.

```sh
npm start
```

Open http://127.0.0.1:4173 in your browser. Stop the server with Ctrl+C.

The server listens only on this computer's loopback interface. It does not publish the app or make it available to other devices. Keep the terminal running while using the app. Use the same local address each time so the browser loads the same saved project.

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
- Physical pin sections with separate left/right headers, channel columns, power terminals, and explicit pin-to-pin connections.
- A 16-channel PWM layout preset with 62 pins and independent repeated labels.
- Header organizer with header creation, drag-and-drop pin moves/reordering, and preserved wiring.
- Independent device duplication, saved drag positions, zoom from 10% to 300%, fit, and an expanded map.
- Component copy/paste with Ctrl+C/Ctrl+V (Command on Mac), bulk new-copy counts, and parent selection.
- Reference file attachments and component specifications.
- JSON backups and Markdown briefs for an AI coding assistant, including changes since a baseline.

Projects and attachments are saved in browser local storage. This repository contains application code and example data; it does not synchronize your personal project data. Export a Project JSON backup to move a project between browsers, origins, or devices.

### Move a project from the previous hosted app

On the old app, choose **Export project → Project JSON → Download JSON**. On the local app, choose **Import**, select that JSON, choose **Replace current project**, review the preview, and apply it. The two addresses have separate browser storage; opening localhost alone does not move a saved project.

See [the user guide](dist/README.md) for import formats and limitations. The wiring cards are logical representations, not manufacturer-specific physical pinouts. Specifications and wiring must be supplied and verified by the user.

## Source layout

- `dist/index.html`: app structure and dialogs
- `dist/style.css`: layout and styles
- `dist/app.js`: component tree, checklist, persistence, and exports
- `dist/studio.js`: pin inventories, wiring view, and parts-list import preview
- `dist/hardware.js`, `dist/hardware.css`: stable pin IDs, nested sections, device instances, grouped board layouts, dragging, and zoom
- `dist/clipboard.js`, `dist/clipboard.css`: independent component snapshots, copy/paste controls, keyboard shortcuts, and bulk paste
- `dist/example-parts.csv`, `dist/example-parts.txt`: import examples
- `preview.cjs`: local static server
- `check.cjs`, `check-studio.cjs`, `check-hardware.cjs`, `check-clipboard.cjs`: verification scripts

The app is intended for local use. Pushing source changes to this repository does not publish a website or change the previous hosted copy.
