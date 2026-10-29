# Partmap MCP: setup, access tests and diagnostics

This is a local **stdio MCP server**, using the official MCP SDK. A compatible client starts a Node.js process, discovers its tools and calls them through JSON-RPC. The server operates on one explicitly configured project directory. It does not depend on the browser or the localhost web server being open. MCP provides a common tool protocol; it does not make a model reliably follow instructions or produce correct wiring.

## 1. Install once

Install Node.js 18 or newer, then in the Partmap source folder run:

```powershell
npm ci
```

The browser app remains usable without these dependencies; the MCP server needs them. Dependencies are pinned in package-lock.json.

## 2. Point an MCP client at your project

Use `mcp/config.example.json` as the template. In a client that accepts an `mcpServers` configuration, set **command** to the absolute Node executable and **args** to the absolute `mcp/server.mjs` path followed by `--project`, the project folder, and optionally `--allow-writes`.

```json
{
  "mcpServers": {
    "partmap": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\path\\to\\partsmapper\\mcp\\server.mjs",
        "--project",
        "E:\\parts_map_demo",
        "--allow-writes"
      ]
    }
  }
}
```

Replace the source path with your actual checkout. Config-file locations and UI vary by MCP client; use its **local stdio server** configuration. A generic JSON file alone does not register a server. Restart/reconnect the client after configuration changes. Do not run `server.mjs` as a background web server: the MCP client launches and owns it. Stdout is reserved for protocol messages; startup notices go to stderr.

Remove `--allow-writes` for read-only access. Different projects need separate configured entries, or a changed project path followed by reconnection. The process does not follow whichever folder is later selected in the browser launcher. This avoids silently switching an agent's workspace.

## 3. Prove access before assigning work

Double-click **Partmap-MCP-Test.cmd**, or choose **9. Test agent/MCP access** in the existing Partmap Server desktop menu. It uses the launcher's selected project folder. To choose another folder explicitly:

```powershell
.\Partmap-MCP-Test.ps1 -ProjectDirectory "E:\parts_map_demo"
```

This checks an actual MCP handshake, tools/list, reading and validating project.json, creating a unique proof file and reading back the exact bytes, rejecting a deliberate invalid argument, and saving diagnostics. It never changes project.json. Proof files remain under `.partmap/mcp-self-tests/`. This tests the local server connection; also test through each actual agent client, since its configuration/approvals can differ.

Give each agent this short initial task:

> Call partmap_status. Confirm the project directory is the intended one. Call partmap_self_test with {"write_test":true}. Report its passed flag, proof path, request ID and projectUnchanged flag. Then call partmap_validate_project with {}. Do not claim access unless those results succeed. If anything fails, call partmap_export_diagnostics with {"save":true} and give me its report path and the failed request ID.

For read-only clients, use `write_test:false` and export diagnostics with `save:false` (the report is returned as JSON). A read-only test does not prove write access. No test commits files to Git; use a separately granted Git tool if the task needs commits.

## 4. Available tools

| Tool | Purpose |
| --- | --- |
| `partmap_status` | Project directory, write mode, session and log location. |
| `partmap_self_test` | Real read/validate test, optional isolated proof write. |
| `partmap_read_project` | Full project and actual SHA-256; defaults to project.json. |
| `partmap_validate_project` | Structural validation; accepts only optional path. |
| `partmap_analyze_project` | Inventory, categories, pins, connections and requirements presence. |
| `partmap_write_project` | Create/update a full project object; existing files require the read hash. |
| `partmap_apply_wiring` | Apply wiring without extra components, changed hierarchy or lost pin/header IDs. |
| `partmap_read_file` | Read project text in pages with full-file SHA-256. |
| `partmap_write_file` | Save Markdown, text, CSV or output JSON with overwrite protection. |
| `partmap_export_project` | Return/save JSON, CSV or an AI Markdown brief. |
| `partmap_export_diagnostics` | Collect recent error metadata, optionally save a shareable report. |

Clients can prefix tool names with the server name. No shell flags, `--node`, `parts.read` strings or hashes belong in validation calls. `.partmap-project.json` is a directory marker, not the project. Hashes are 64-character SHA-256 values returned by reads; never substitute a filename, tool name, file length or placeholder.

Before writes, pause editing in the browser and other clients. Read the latest project, retain all existing data, pass its hash, then use **Reload folder** in standalone Partmap or **Reload latest** in Character Room. MCP processes coordinate writes with per-file locks and compare hashes. The browser is a separate writer: do not edit simultaneously. JSON backups made by MCP are under `.partmap/mcp-backups/`. Interrupted processes can leave a `.partmap-mcp-lock` file; inspect for a running writer before removing that lock manually.

For wiring tasks use `partmap_apply_wiring`; this keeps existing component IDs/count, quantities, parents, pin/header IDs and unrelated project metadata. It validates structure but cannot verify physical voltage limits, pinouts, current budgets or power-up behavior. Missing hardware information must still be recorded in missing-requirements.md.

## 5. What to send when it fails

Each tool result has a **requestId**. Errors have `isError:true`, `ok:false`, and an error **code**, **message** and **hint**. Tool calls, validation failures, successes and protocol errors are recorded in JSONL files under the source folder's `.partmap-runtime/mcp/logs/`. `partmap_status` returns the exact current log path. Logs rotate per process at roughly 2 MiB; old sessions are retained for diagnosis.

Ask for `partmap_export_diagnostics` with `save:true`. Send its `.partmap/mcp-diagnostics/<id>.json` report and the request ID. If the project filesystem rejects the report write, it falls back to the server log directory under reports/. The result includes savedPath, location=server-log-fallback and projectWritable=false; a saved diagnostic report does not mean project writes succeeded. The report includes recent events from up to five sessions. The Windows test also writes `.partmap-runtime/mcp/last-access-test.json`, useful if the connection cannot start. For a startup failure, send that file and any stderr from your MCP client's server panel.

Diagnostics intentionally omit tool argument values and full project/file content. They contain local folder paths, filenames, tool names and error text; inspect the report before sharing. Logs cannot include an invalid model response that never reached the MCP client/server. For those failures, also send Character Room's **App-verified tool record** and the exact model-format error. MCP does not bypass client approvals, character grants or OS permissions.

| Code | Meaning / next action |
| --- | --- |
| `MCP_CONNECTION_ERROR` | Check Node, npm ci, absolute paths and client startup stderr. |
| `PROJECT_NOT_FOUND` / `FILE_NOT_FOUND` | Check configured folder and project.json. |
| `READ_ONLY` | Add --allow-writes and reconnect if write access is intended. |
| `INVALID_ARGUMENTS` | Use only the advertised tool fields; no CLI argument arrays. |
| `WRONG_PROJECT_FILE` | Use project.json, not .partmap-project.json. |
| `INVALID_PROJECT` | Pass a full project object and correct hierarchy/pin references. |
| `REVISION_CONFLICT` | Stop simultaneous edits, read again and use the returned hash. |
| `WIRING_REJECTED` | Preserve existing inventory/pin/header IDs; use a current snapshot. |
| `PATH_DENIED` | Keep paths inside the configured folder; links, secrets and metadata are blocked. |
| `PROJECT_WRITE_FAILED` | Write mode is enabled, but the filesystem rejected a specific operation. Read error.details for operation, path, underlying Node code and errno. Check the device and use a verified working copy on another drive if needed. |
| `FILE_BUSY` | Another MCP writer holds the file lock; inspect/retry. |
| `EACCES` / `EPERM` | OS access failed; include diagnostics rather than changing grants blindly. |

## Character Room integration

The accompanying Character Room update can route its existing Partmap tools through this real MCP client. Its private installation file `partmap-mcp.json` contains absolute `node` and `client` (mcp/client.mjs) paths plus `allow_writes`. This file belongs beside Character Room's server.py, outside agent project folders. Existing character grants and assigned chat project directories are still checked before starting MCP. The visual Partmap location in tool settings remains the studio's dist folder.

Agents see `parts_status`, `parts_self_test`, `parts_diagnostics` and the existing read/validate/analyze/export/write tools. Character Room translates these names into the MCP tools. MCP errors, request IDs and log paths also appear in Tool activity. Do not confuse this built-in adapter with configuring an unrelated external MCP client. Changing one client's configuration does not configure another.

## Developer verification

Run `npm test` for all studio checks and real MCP stdio integration tests, or `npm run test:mcp` alone. Tests use temporary fixture projects, not your hardware project.

Protocol reference: [official MCP SDK server documentation](https://ts.sdk.modelcontextprotocol.io/server). The implementation uses the SDK’s stdio transport and tool schemas; project access, tests and diagnostic files are specific to Partmap.

On Windows, a generic UNKNOWN filesystem error can hide a device-level failure. The observed E: incident returned native Windows error 433 (a device which does not exist was specified), while equivalent C: creation worked. Do not treat that as a missing MCP grant. Preserve readable data, record any unreadable files, and explicitly select/reassign a verified working directory. The intentional INVALID_ARGUMENTS errorProbe in access-test output is expected; the proof and diagnostic results determine actual access.
