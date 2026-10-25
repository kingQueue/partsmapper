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

Wiring is a third map view. It shows electronic components as generic board-style cards with physical pin sections and colored wire lines. These are logical representations, not manufacturer-specific physical pinouts. Click a pin to connect it. Source and target dropdowns include section paths. Every physical pin has its own stable ID, so Left header / GND, Right header / GND, and Channel 0 / GND are distinct even when their labels repeat. Pin renames and moves between sections preserve wires. Deleting a connected pin or section asks before removing its wires. Connections appear from both ends and in JSON and firmware briefs. Older projects migrate their existing wiring into stable pin IDs without changing the assigned connections.

### Pin sections and the 16-channel PWM preset

Choose the preset when creating a component, or select an existing component and use **16-channel PWM preset** in its details. It adds the layout supplied for this project: Left and Right logic headers, each with GND, VCC, SDA, SCL, OE, and V+; channels 0–15, each with PWM, V+, and GND; and a power screw terminal with V+ and GND. The preset adds missing pins and preserves existing ones and wires. It does not assert electrical equivalence between repeated labels or verify an exact manufacturer's board.

Use **+ Section** to add a header, actuator channel, terminal, or parent section group. Sections can be nested, renamed, repositioned in the board layout, and deleted. Use **+ Pin here** to add a pin directly to that section. The app supports up to 64 sections and 512 physical pins per component. For quick creation or CSV/TXT imports, write `Left header::GND;Right header::GND;Right header::3.3V` in the pins field. These create separate sections; use section editing for deeper nesting. JSON preserves the complete nested section hierarchy and stable IDs.

### Device instances and map arrangement

Adding an electronic component with quantity 2 creates two independent map objects, each with a unique component ID and its own pin IDs. CSV/TXT imports do the same for electronic quantities; mechanical quantities such as screws remain a single part entry with a quantity. Imported child rows attach to the original parent instance; use explicit parent rows or edit parents to assign children to additional instances.

**Duplicate** creates an independent copy of the selected component's specifications, pin sections, pins, and reference files. It does not duplicate child components or electrical connections; attach and wire each new device explicitly.

Drag a component in the product map or drag a board's title in Wiring to reposition it. Wire endpoints update as it moves. Positions save automatically, survive reload, and travel with JSON exports. Product/electronics views share a tree layout; Wiring has its own saved layout. Moving components does not count as a firmware change in the AI brief.

Use the visible minus/plus buttons, the 10%–300% zoom slider, or Ctrl/Command + mouse wheel to zoom. The fit button fits the visible map; **Expand map** provides a larger workspace. **Auto arrange** clears manual positions in the current layout and restores the generated arrangement.

Reference uploads: PNG, JPG, GIF, WebP, PDF, TXT, MD, JSON, CSV; maximum 1.5 MB per file. This version stores files as references and does not automatically extract specifications from datasheets. Enter component details manually. Browser storage limits apply; a failed save displays a warning. This version supports up to 300 nodes.

The starter project is illustrative. Verify exact models, voltage/current, drivers, bus addresses, and all pin connections against your hardware before firmware or power-up. The visual lines describe assembly hierarchy; electrical connections are recorded separately in node details. Design prompts are rule-based checks, not live datasheet research or an embedded AI service.
