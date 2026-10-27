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

Choose **Organize headers · drag pins** in a board's details to open the header workspace. Create an empty header using its name, layout, and optional parent section, then drag pins from an old group onto the new header. Drop onto a pin to insert before it or onto empty header space to append. The sidebar supports the same gestures; hovering over a collapsed section opens it. **Move a pin using selectors** provides a keyboard-friendly alternative. Moves preserve each pin's ID, type, notes, and all incoming and outgoing connections. The wire map, connection labels, saved project, and exports update automatically. A move transfers the pin; it does not create a new copy.

### Device instances and map arrangement

Adding an electronic component with quantity 2 creates two independent map objects, each with a unique component ID and its own pin IDs. CSV/TXT imports do the same for electronic quantities; mechanical quantities such as screws remain a single part entry with a quantity. Imported child rows attach to the original parent instance; use explicit parent rows or edit parents to assign children to additional instances.

**Duplicate** creates an independent copy of the selected component's specifications, pin sections, pins, and reference files. It does not duplicate child components or electrical connections; attach and wire each new device explicitly.

### Copy and paste identical parts

Select a component and click **Copy part** above the map, or **Copy** in its details. Click **Paste** to create another independent instance. **New copies** is the number of additional components to create: to get four identical encoders, copy the first one, enter **3**, and paste. Repeat for your first wheel motor. Use **Attach copies to** to keep the original parent, choose another existing component, or place copies at the product root.

Ctrl+C / Ctrl+V (Command+C / Command+V on Mac) work when a component is selected and you are not editing text or using a dialog. Text fields and selected page text retain normal copy/paste behavior. Keyboard paste uses the same New copies count and destination controls as the Paste button. If browser clipboard access is unavailable, Copy part and Paste still work inside the current page; copying via the buttons will explain that fallback.

Copies include the saved specifications, nested pin sections, pin types/notes, and reference files. Each receives a distinct component ID and distinct physical pin IDs, so changing one does not edit the others. Children and electrical wires are not copied. A copied snapshot remains unchanged if its original is later edited or removed. The source parent is reused only if it still exists; otherwise copies go to the product root. Component clipboard text can also be pasted into another Partmap project or after a reload; the in-page clipboard itself resets on reload.

Drag a component in the product map or drag a board's title in Wiring to reposition it. Wire endpoints update as it moves. Positions save automatically, survive reload, and travel with JSON exports. Full product, electronics, and Wiring now use the same world coordinates. Dragging in either map updates the shared layout. Existing product positions take priority over older separate wiring positions; a wiring-only position is reused when no product position exists. Larger wiring cards may need additional spacing. Auto arrange resets the shared positions. Moving components does not count as a firmware change in the AI brief.

Use the visible minus/plus buttons, the 10%–300% zoom slider, or the mouse wheel to zoom around the cursor. Hold Shift while scrolling to move horizontally; a horizontal trackpad or mouse-wheel gesture also scrolls sideways. Drag empty map space to pan in any direction, or use the horizontal and vertical scrollbars. Component dragging still moves only that component. The fit button fits the visible map; **Expand map** provides a larger workspace. **Auto arrange** clears manual positions in the current layout and restores the generated arrangement.

Reference uploads: PNG, JPG, GIF, WebP, PDF, TXT, MD, JSON, CSV; maximum 1.5 MB per file. This version stores files as references and does not automatically extract specifications from datasheets. Enter component details manually. Browser storage limits apply; a failed save displays a warning. This version supports up to 300 nodes.

The starter project is illustrative. Verify exact models, voltage/current, drivers, bus addresses, and all pin connections against your hardware before firmware or power-up. The visual lines describe assembly hierarchy; electrical connections are recorded separately in node details. Design prompts are rule-based checks, not live datasheet research or an embedded AI service.


### Shared component library and PCB workspace

The Component library appears above the product map and in the left navigation. Search the starter templates, drag one down into the map, or use its + button. The destination selector assigns a parent. These generic ESP32, RP2040, PWM-driver, encoder, motor, and OLED templates are editable starting points, not verified full pinouts. Every placement gets independent component and pin IDs with no copied wiring.

Select any project component and choose **Save to library** to keep its specifications, nested headers, reference files, and reusable firmware notes. The saved snapshot is independent of later project edits. Library templates persist separately in this browser and can be downloaded with **Export library**; they are not included in Project JSON. Firmware notes copy into new components and their normal AI handoff. Versioned executable firmware modules and dependency management are future features.

Choose **Make a PCB** in the green navigation column. Drag from the same component library or from the current project's electronic parts onto the board; + buttons also place parts. Set the board name and size in millimeters, drag blocks on a 1 mm placement grid, resize generic component blocks, rotate them, and remove placements. Board dimensions range from 20 to 500 mm. Placements cannot extend outside the board; shrinking a board rejects a size that would exclude an existing placement. The canvas scrolls in both axes and has zoom controls.

PCB placements preserve a component snapshot and source reference. They do not add/remove project parts or change electrical wiring; deleting or editing the source does not automatically alter a placed snapshot. PCB sketches save with the current project and are included in full Project JSON backup/import. **Export PCB sketch** downloads a separate placement document. This is a placement foundation: it does not define actual footprints/pads, route copper, generate drills or Gerbers, or check manufacturability. The Gerber button is visibly marked as planned.


### Special header styles and interactive wires

Choose **+ Section** or **Edit section**, then set **Header style**. The organizer's Create header form offers the same styles. **Servo bank** creates sixteen channel sections arranged as four banks of four. Each channel has its own PWM, V+, and GND pin, giving sixteen distinct servo connection points and 48 physical pins. Existing channel pins retain their IDs and labels when the style is edited. **Screw terminal block** supports 1–32 pins and top/bottom placement; the diagram shows a labeled screw hole for each terminal. Increasing its count adds new independent pins; reducing it asks before deleting the excess pins and their connections. Rename generic Terminal labels to match the hardware.

The PWM preset now uses the grouped servo-bank style and a two-hole top screw terminal (V+ and GND), with separate left/right logic headers. Existing sections generated by the previous preset upgrade visually while retaining pins and connections. Styles are preserved in saved templates and JSON exports.

Hover over a wire in Wiring to highlight it. Click it (or focus it with Tab and press Enter) to inspect the two endpoints and choose **Delete connection** or **Keep connection**. Deleting a wire preserves both components and their pins. Wires have a wider invisible click area to make thin lines easier to select.


### Box selection and moving groups

On the product/electronics map, Wiring, and the PCB workspace, enable **Box select** and drag an empty area to draw a selection rectangle. **Shift + drag** on empty space also works while pan mode is active. The rectangle selects components it touches. Shift extends an existing selection; Ctrl/Command/Shift + click on a component toggles that component in the group. Drag a selected component (its title in Wiring) to move all visible selected components together, preserving their spacing. **Clear selection** clears the group. Turn off Box select to pan by dragging empty space again. PCB groups stay on the millimeter grid and stop together at board edges, preserving their arrangement. Cancelled pointer gestures restore all affected positions.

Product and Wiring selection follows the same component identities and shared coordinates. PCB placements have their own selection because they are separate placement snapshots. Group movement changes layout only; it does not change assembly parents or electrical connections.

Editing feedback appears as a persistent, high-contrast message inside the active dialog, above the form. Top and bottom header sections are now horizontal and centered on the board, above and below the left/right sections; screw-terminal blocks are centered as well. Wire endpoints track the updated terminal positions.
