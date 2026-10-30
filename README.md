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

Use the included server for project-folder saving. A generic static server supports browser-only storage and downloads.

### Windows server menu

Double-click `Partmap.cmd` to open the server and project menu. Choose **6. Create new project folder** (browse to its parent and enter a name), or **7. Browse and open existing project folder** (select a folder containing `project.json`). Then choose **1** to start and open Partmap. **8** opens the selected folder in Explorer. The server runs in the background; closing the menu leaves it running. Use **2** to stop it. Selecting a folder does not delete browser backups or other projects.

For direct commands, use `Partmap.cmd start`, `Partmap.cmd stop`, `Partmap.cmd restart`, `Partmap.cmd status`, `Partmap.cmd open`, `Partmap.cmd create`, `Partmap.cmd select`, or `Partmap.cmd folder`. The menu requires Node.js 18+ and Windows PowerShell. Runtime logs are written under `.partmap-runtime/` and excluded from Git. The Stop command only targets the Node process running this checkout's absolute `preview.cjs` path; it refuses to stop unrelated processes using port 4173. If an older manually started server uses that port, stop it in its original terminal before using the menu.

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

With a project folder selected, changes autosave to disk; the banner shows its path and save status. **Save now** flushes pending changes. The folder contains:

- `project.json`: complete project, pins, connections, checklist, PCB placements, and embedded references.
- `ai-brief.md` and `missing-requirements.md`: readable context and wiring review.
- `component-library.json` and `pcb-sketch.json`: reusable components and PCB placement data.
- `references/`: extracted uploads with an index connecting files to component IDs.
- `exports/`: JSON, Markdown, library, PCB, reference, and wiring ZIP exports.
- `wiring-handoff/`: unpacked agent prompt, project snapshot, starter command, requirements, and instructions.
- `.partmap/backups/`: automatic project backups before changed saves, at most once per minute.

Agents can read this directory directly. Use **Auto complete wiring**, have the agent write its results inside `wiring-handoff/`, then apply the returned JSON through **Update wiring (no new components)**. Direct external edits to the root project, requirements, or library pause saving until **Reload folder**; a browser recovery copy is retained. Save before switching folders, closing, or asking an agent to edit files. Only one editing tab should be open per project.

Browser local storage remains a recovery cache. With no folder selected, the app supports browser-only storage and downloads. Personal project directories and runtime selection are excluded from this source repository. Move or back up the entire selected directory to keep files together.

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
- `dist/project-folder.js`: disk autosaves, folder status, conflict recovery, and export routing
- `project-store.cjs`: project-folder selection, atomic writes, extracted references, and revision checks
- `preview.cjs`: loopback server and local project-folder API
- `check.cjs`, `check-studio.cjs`, `check-hardware.cjs`, `check-clipboard.cjs`: verification scripts

The app is intended for local use. Pushing source changes to this repository does not publish a website or change the previous hosted copy.


## Agent access through MCP

See [MCP-SETUP.md](MCP-SETUP.md) for the local stdio server, client configuration, agent access-proof sequence and shareable error logs. Run npm ci once, then use option 9 in the Windows launcher or Partmap-MCP-Test.cmd to verify the selected project without changing its hardware map.


## Manage projects inside Partmap

Click **Projects** in the left navigation or top bar. Search recent projects, open a local directory containing project.json, or create a named project in a chosen parent folder. **Browse** opens the native Windows folder picker; typing an absolute path also works. A new project starts empty and autosaves all project files into its new directory. Existing directories are not replaced during creation.

Switching saves pending edits first. If external edits or a disk error paused saving, reload the current folder or explicitly choose to keep a browser recovery copy and switch without saving. Other tabs are protected by active-folder and revision checks. Recents are stored locally beside the launcher's runtime configuration; there is no cloud account or project upload.

This manager requires the included local server. The Character Room embedded studio remains scoped to the chat's assigned project directory; select chat projects through Character Room's existing folder assignment controls. Opening a different standalone project does not silently reassign agent chats or external MCP client folders.
