# Partmap

Open index.html in a modern browser, or serve this folder with any static web server.

Your project is saved automatically in this browser on this device. Download a Project JSON regularly for backup or moving between devices. Uploaded reference files are stored in that JSON; AI briefs include filenames only, so provide the reference files separately to your assistant.

1. Rename the example project and add components. Choose a parent to nest assemblies or parts.
2. Select any node to change its category, parent, quantity, model, notes, electrical interface, firmware notes, connections, or reference files.
3. Use category checkboxes or Electronics only to change the displayed map. Filtering never deletes components. Exports contain the whole product.
4. Mark sourced/printed parts ready in the Parts checklist.
5. Open Export project. Use AI brief for a coding assistant or Project JSON for a complete backup. Set current baseline when you want future exports to compare against the current revision. Exporting alone does not reset the baseline.

Import opens a preview for CSV, TXT, pasted text, or Partmap JSON. Choose Add to current project or Replace current project, then generate the map. CSV requires a name column (aliases: part, component, description). Optional columns: id, parent, category, model, quantity (alias: qty), notes, voltage, interface, firmware, ready, pins. Separate pin names with semicolons. Parent values can reference an ID or a unique component name in the imported list. Category values: board, sensor, motor, power, peripheral, printed, fastener, mechanical. When omitted, categories are inferred from simple name rules and quantities default to 1. Review categories in the preview. Import rejects cycles, missing or ambiguous parents, duplicate IDs or pins, invalid quantities, and invalid connection targets. Appending remaps imported IDs to preserve existing components and wiring.

Text lists use one part per line. Indentation creates children. Use “4x M3 screws” or “M3 screws x4” for quantities. Structured lines use: Name | quantity | category | parent | pin1;pin2. Lines beginning with # are comments. Download the CSV and TXT examples from the import dialog.

Wiring is a third map view. It shows electronic components as generic board-style cards with the pins you define and colored pin-to-pin wire lines. These are logical representations, not manufacturer-specific physical pinouts. Click a board to inspect it, or click a pin to connect it. In component details, add or edit pins, choose their type and notes, and optionally select another component and one of its pins. Define target pins first. New component creation also accepts comma-, semicolon-, or newline-separated pin names. Pin renames update existing wires; deleting a connected pin asks before removing its wires. Connections are visible from both ends and appear in JSON and firmware briefs. Previously recorded connection names migrate into explicit pins automatically.

Reference uploads: PNG, JPG, GIF, WebP, PDF, TXT, MD, JSON, CSV; maximum 1.5 MB per file. This version stores files as references and does not automatically extract specifications from datasheets. Enter component details manually. Browser storage limits apply; a failed save displays a warning. This version supports up to 300 nodes.

The starter project is illustrative. Verify exact models, voltage/current, drivers, bus addresses, and all pin connections against your hardware before firmware or power-up. The visual lines describe assembly hierarchy; electrical connections are recorded separately in node details. Design prompts are rule-based checks, not live datasheet research or an embedded AI service.
