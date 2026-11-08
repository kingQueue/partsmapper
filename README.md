# Partmap

A local, manual workspace for parts inventories, product maps and wiring diagrams. No account, cloud service, agent connection or API key is required.

## Getting started

Partmap uses **Node.js 18 or newer on Windows, macOS and Linux**. Python is not required. Install Node.js from [nodejs.org](https://nodejs.org/), then reopen your terminal so the `node` command is available.

Download this repository using **Code → Download ZIP** on GitHub and extract it, or clone it:

```sh
git clone https://github.com/kingQueue/partsmapper.git
cd partsmapper
```

If you downloaded the ZIP, your extracted folder may be called `partsmapper-main`. Keep all included files together. There are no third-party runtime dependencies: no `npm install`, Python packages, API keys or environment file are needed.

### Windows: use the CMD launcher

1. Open the extracted repository folder in File Explorer.
2. Double-click **`Partmap.cmd`**. This opens the local server menu using Windows PowerShell.
3. On first launch, choose **6** to create a project folder, or **7** to browse for an existing folder containing `project.json`.
4. Choose **1** to start the server and open Partmap in your browser at **http://127.0.0.1:4173/**.
5. You can close the menu window while working; the server stays running. Double-click `Partmap.cmd` again whenever you need the controls.

| Option | Action |
| --- | --- |
| 1 | Start the server and open the selected project in the browser |
| 2 | Stop the server |
| 3 | Restart the server |
| 4 | Open Partmap in the browser; starts the server if needed |
| 5 | Refresh the running status |
| 6 | Choose a parent folder and create a new named project directory |
| 7 | Browse for an existing project folder containing `project.json` |
| 8 | Open the selected project folder in File Explorer |
| 0 | Close the menu without stopping the server |

The launcher’s browser options require a selected project. Alternatively, start with `npm start` below and use **Projects** inside the app to create or open one.

From **Command Prompt**, you can also run the launcher directly. Replace the example path with your extracted folder:

```bat
cd /d "C:\path\to\partsmapper"
Partmap.cmd
```

Direct commands are available when you do not want the menu:

```bat
Partmap.cmd -Action start
Partmap.cmd -Action status
Partmap.cmd -Action open
Partmap.cmd -Action stop
Partmap.cmd -Action restart
```

`start` starts the background server; `open` also opens the browser and requires a selected project. To create or select a project without the menu:

```bat
Partmap.cmd -Action create -ProjectDirectory "C:\Partmap Projects\My Robot" -ProjectName "My Robot"
Partmap.cmd -Action select -ProjectDirectory "C:\Partmap Projects\My Robot"
```

To put the launcher on your desktop, create a **shortcut to `Partmap.cmd`**. Keep the actual CMD file in the repository folder alongside `Partmap-server.ps1` and `preview.cjs`.

### macOS: start from Terminal

Use Node.js on macOS too; there is no Python server command needed for the full app. Open Terminal and change to the downloaded or cloned repository folder:

```sh
cd "$HOME/Downloads/partsmapper-main"
node --version
node preview.cjs
```

If you cloned the repository, use its actual location instead, for example `cd "$HOME/partsmapper"`. You can use `npm start` in place of `node preview.cjs`; both start the same server.

When Terminal prints `Partmap is running locally`, open **http://127.0.0.1:4173/** in Safari, Chrome or another browser. In a second Terminal tab, you can open it with:

```sh
open http://127.0.0.1:4173/
```

Use **Projects** in the app to create a local project directory or open an existing one. Keep the server Terminal window open while using Partmap. Press **Control+C** in that window to stop it; run `node preview.cjs` again to restart. The Windows CMD/PowerShell launcher is not used on macOS.

A Python `http.server` only serves static files and does not provide Partmap’s project-folder APIs. Use the included Node.js server for local project management, saving and exports.

### Any platform: npm startup

From the repository folder:

```sh
npm start
```

Open **http://127.0.0.1:4173/**. The server binds to your computer’s loopback interface and is not exposed to your local network. Press **Control+C** in the server terminal to stop it.

### Saving and troubleshooting

- **Choose a project folder:** use **Projects → Create project** or open an existing directory containing `project.json`. Without a selected folder, the app uses browser storage; export a JSON backup before clearing browser data.
- **Save locally:** edits autosave to the selected project directory. Check the folder status or click **Save now** before closing. Keep your project folders outside the downloaded application folder so an application update does not replace your work.
- **Node is not recognized / command not found:** install Node.js, reopen Terminal or Command Prompt and check `node --version`.
- **Port 4173 is already in use:** try opening the existing local app first. If another Partmap server is running, stop it through its launcher or with Control+C in its original terminal before starting another instance.
- **Windows launcher will not open:** run `Partmap.cmd` from Command Prompt to see its error. Confirm that Node.js is installed and that `Partmap.cmd`, `Partmap-server.ps1` and `preview.cjs` are still in the same extracted folder.
- **Folder changes conflict:** reload the folder before continuing. Partmap pauses saving rather than overwriting a newer disk version and keeps browser recovery data.
- **Windows server logs:** look under `.partmap-runtime/server.log` and `.partmap-runtime/server-error.log` in the application folder.

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
