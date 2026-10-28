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

### Windows server menu

Double-click `Partmap.cmd` to open the Start/Stop/Restart menu. Start opens http://127.0.0.1:4173/ in your default browser. The server runs in the background; closing the menu does not stop it. Use Stop to shut it down. Browser-saved projects remain intact.

For direct commands, use `Partmap.cmd start`, `Partmap.cmd stop`, `Partmap.cmd restart`, `Partmap.cmd status`, or `Partmap.cmd open`. The menu requires Node.js 18+ and Windows PowerShell. Runtime logs are written under `.partmap-runtime/` and excluded from Git. The Stop command only targets the Node process running this checkout's absolute `preview.cjs` path; it refuses to stop unrelated processes using port 4173. If an older manually started server uses that port, stop it in its original terminal before using the menu.

Create a desktop shortcut to `Partmap.cmd` for quick access. This chat's installation has a **Partmap Server** desktop shortcut already configured.


## Check the app

```sh
npm test
```

The checks cover tree validation, import parsing, baseline changes, pin inventories, wiring, and firmware exports. They use a lightweight DOM stub; they are not a complete browser test suite.

## Features

- Nested component trees with full product and electronics-only views.
- Automatic map-presence checklist, retained unchecked entries for removed parts, restoration, and a Complete sidebar badge.
- CSV, TXT, pasted-list, and JSON imports with a preview and append/replace options.
- Physical pin sections with separate left/right headers, channel columns, power terminals, and explicit pin-to-pin connections.
- A 16-channel PWM layout preset with four banks of four servo connectors, 62 independent pins, and a two-hole top screw terminal.
- Configurable screw-terminal header styles, product-relative wiring with automatic clearance, and hover/select/delete wire interactions.
- Header organizer with header creation, drag-and-drop pin moves/reordering, and preserved wiring.
- Independent device duplication, saved drag positions, zoom from 10% to 300%, fit, and an expanded map.
- Component copy/paste with Ctrl+C/Ctrl+V (Command on Mac), independent copies, preserving the original parent.
- Shared component library with draggable starter boards, independent instances, and saved project-part templates.
- PCB placement workspace using library or project parts, millimeter sizing, movable/rotatable blocks, and JSON sketch exports.
- Reusable firmware notes in component templates; executable firmware libraries and manufacturing Gerber export are planned.
- Box selection and group dragging in product, wiring, and PCB views; visible validation feedback inside dialogs.
- Compact wiring boards and PCB header previews/inventories, preserving complete header and pin definitions through component copies.
- Reference file attachments and component specifications.
- Missing requirements sidebar with safe Markdown viewing/editing/import and per-project document persistence.
- Auto complete wiring task packages: one ZIP with full JSON, agent prompt, starter command, and requirements Markdown.
- Wiring-only updates with inventory locks and stale-result checks, preventing full-project append duplication.
- JSON backups and Markdown briefs for an AI coding assistant, including changes since a baseline.

Projects and attachments are saved in browser local storage. This repository contains application code and example data; it does not synchronize your personal project data. Export a Project JSON backup to move a project between browsers, origins, or devices.

### Move a project from the previous hosted app

On the old app, choose **Export project → Project JSON → Download JSON**. On the local app, choose **Import**, select that JSON, choose **Replace current project**, review the preview, and apply it. The two addresses have separate browser storage; opening localhost alone does not move a saved project.

See [the user guide](dist/README.md) for import formats and limitations. The wiring cards are logical representations, not manufacturer-specific physical pinouts. Specifications and wiring must be supplied and verified by the user.

## Source layout

- `dist/index.html`: app structure and dialogs
- `dist/style.css`: layout and styles
- `dist/app.js`: component tree, non-cascading component removal, persistence, and exports
- `dist/assembly.js`: retained checklist plans, automatic map-presence status, restoration, and completion feedback
- `dist/wiring-handoff.js`: requirements Markdown workspace, project document persistence, and agent ZIP exports
- `dist/studio.js`: pin inventories, wiring view, and parts-list import preview
- `dist/hardware.js`, `dist/hardware.css`: stable pin IDs, nested sections, device instances, grouped board layouts, dragging, and zoom
- `dist/clipboard.js`, `dist/clipboard.css`: independent component snapshots, keyboard shortcuts, independent copies, and component-detail clipboard actions
- `dist/workbench.js`, `dist/workbench.css`: reusable component templates, firmware-note reuse, and PCB placement sketches
- `dist/example-parts.csv`, `dist/example-parts.txt`: import examples
- `preview.cjs`: local static server
- `check.cjs`, `check-studio.cjs`, `check-hardware.cjs`, `check-clipboard.cjs`: verification scripts

The app is intended for local use. Pushing source changes to this repository does not publish a website or change the previous hosted copy.
