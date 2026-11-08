# Fluidify — experimental fluid circuit mapping

Open **Fluidify · Experimental** from the left sidebar. It is a separate fluid mechanical graph within the current project; electrical boards, pins and wires are kept in the product/electronics workspace.

- Add or drag reservoirs, pumps, control/check valves, hoses, tees, filters, accumulators, gauges, cylinders, fluid motors or custom fluid parts.
- Click an outlet port followed by an inlet to add a directed hose. Bidirectional ports can send or receive. A port accepts one hose; use junctions for branches. Click a hose to delete it.
- Edit names, exact models, quantities, assembly parents, fluid medium, pressure/flow ratings, bore size and notes. Add, rename, remove and change the direction of physical fluid ports.
- Drag components; drag empty space to pan; use the wheel or buttons to zoom. Shift-drag or Box select selects a group. Ctrl/Cmd+C/V duplicates independent components/ports and hoses internal to the copied group. Delete retains child components as circuit roots.
- Dashed lines are assembly relationships, distinct from fluid connections. Cycles in the assembly hierarchy are rejected; closed fluid loops are allowed.
- Export/import a standalone circuit JSON. Full project JSON also includes the circuit. Project-folder saves refresh `fluidify-circuit.json`; the main record is `project.json.fluidify`. Parts reports include the experimental fluid data.

Documents use `format: "partmap.fluid-circuit"`, `version: 1`, `nodes`, `connections` and a saved `viewport`. Each connection references exact component/port IDs. Pressure is in bar, flow in L/min and bore diameter in mm. Unknown specifications remain blank/null.

Fluidify is a conceptual map, not a hydraulic/pneumatic simulator or a standardized engineering schematic. It does not calculate pressure drops, flow distribution or component/material compatibility. Generic palette parts do not assert actual device ratings.

Validation: `node check-fluidify.cjs` covers port/direction rules, closed circuits, independent copies, orphan-preserving deletion, native model round trips and project-folder persistence without changing electrical inventory. The browser flow was verified in an isolated test project rather than adding example hardware to a user project.
