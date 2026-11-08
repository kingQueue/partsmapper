# Partmap

A local, manual workspace for parts inventories, product maps and wiring diagrams. No account, cloud service, agent connection or API key is required.

## Run locally

Install Node.js 18 or newer, then run:

```sh
npm start
```

Open http://127.0.0.1:4173. The server binds to your computer's loopback interface. There are no third-party runtime dependencies.

On Windows, double-click `Partmap.cmd` to start/stop the server, create a project folder, or open an existing project.

## Manual workspace

- Create, browse and save local projects through Projects.
- Add components individually or import a CSV, text parts list or project JSON.
- Use the full product map, electronics view and pin-to-pin wiring diagram.
- Create pin headers, including left/right headers, servo banks and terminal blocks.
- Copy/paste components, move selections together, zoom and pan the map.
- Save configured components to your local reusable component library, then drag templates into the map.
- Track parts in the checklist and record project notes or reference attachments.
- Export project JSON, a readable parts report, library templates and PCB placement sketches.
- Experiment with conceptual fluid circuits in Fluidify.

Wiring connections are entered manually. Parent/child relationships describe assembly and do not imply an electrical connection. Verify pinouts, power, current ratings and logic levels against your hardware documentation. PCB sketches are conceptual placements, not manufacturing-ready Gerbers. Fluidify does not simulate pressure or flow.

## Local files and privacy

The selected project folder contains `project.json`, `component-library.json`, `parts-report.md`, `missing-requirements.md`, `pcb-sketch.json` and, when used, `fluidify-circuit.json`. Uploaded attachments are extracted under `references/`. Exports go to `exports/`; periodic project backups go to `.partmap/backups/`. Browser storage retains recovery copies.

Runtime selection data and local logs stay under the ignored `.partmap-runtime/` directory. Project folders and uploads are user data: do not commit them to a public repository. `.env`, credential files, runtime files and dependencies are ignored. The application has no environment configuration loader, credential endpoint, external API client, MCP server or agent dispatcher. The browser is served only packaged assets under `dist/`, with hidden files denied. Filesystem operations use local origin checks and a per-process request token, which is not an API credential.

Older projects can be opened. Existing parts, headers, pins, layout and connections remain usable; obsolete agent task metadata is not part of new exports. Old handoff files in existing project directories are left untouched and are not loaded or executed.

## Development

```sh
npm test
```

Tests cover manual maps, headers, wiring import safeguards, independent copies, PCB placement, local project saves, conflict handling, origin checks and removal of integration endpoints.
