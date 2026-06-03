# Release QA matrix

Use this checklist before tagging a release. Mark each row **Pass** / **Fail** / **N/A**.

## Environment

| Step | Pass |
|------|------|
| `npm install` clean | |
| `npm test` all green | |
| `npm run build` succeeds | |
| `npm run test:e2e` smoke green | |
| `npm run dev` loads without console errors | |

## File I/O

| Scenario | Steps | Pass |
|----------|-------|------|
| New scene | File → New; confirm if dirty | |
| Save project | Add cube, Save, reopen `.pixacad.json` | |
| Unsaved warning | Edit mesh, File → New / Load → confirm dialog | |
| Tab close warning | Edit without save, close tab | |
| OBJ round-trip | Export OBJ, import OBJ | |
| GLTF round-trip | Export GLTF, import GLTF | |

## Viewport defaults

| Check | Expected | Pass |
|-------|----------|------|
| Wireframe | ON at startup (status bar) | |
| X-Ray | OFF at startup | |
| Face wireframe | Quads show 4 edges, no diagonal | |

## Object mode

| Scenario | Pass |
|----------|------|
| Add cube / sphere / plane | |
| Select, move, rotate, scale gizmo | |
| Copy / paste (Ctrl+C/V) offset copy | |
| Delete object | |
| Duplicate | |

## Vertex mode

| Scenario | Pass |
|----------|------|
| Select vertex, drag gizmo | |
| Snap ON, grid 0.01 — smooth movement | |
| Multi-select (Shift), box select | |
| Delete vertices | |
| After poly tool: vertex pick works | |
| After knife: vertex pick works | |

## Edge mode

| Scenario | Pass |
|----------|------|
| Select edge, move | |
| Split edge (J) | |
| Extrude edge | |

## Face mode

| Scenario | Pass |
|----------|------|
| Select face, paint color | |
| Extrude face (E), confirm click | |
| Extrude outward (not inward) | |
| Delete faces | |
| Flip normals | |

## Poly draw

| Scenario | Pass |
|----------|------|
| Start poly on empty → first face creates object | |
| After face: object mode, object selectable | |
| Esc cancels in-progress draw | |
| Backspace removes last point | |
| Tri / quad modes complete at N verts | |
| Polygon mode: Enter or click first point closes | |

## Knife

| Scenario | Pass |
|----------|------|
| K on selected mesh enters knife | |
| Two points on same face → cut, 2 faces | |
| Yellow/red preview line | |
| After cut: face mode, knife OFF | |
| Object/vertex/face pick works after cut | |
| Esc cancels knife mid-cut | |
| Failed cut: message, can retry | |

## Tools & history

| Scenario | Pass |
|----------|------|
| Undo / redo after extrude | |
| Undo / redo after knife | |
| Weld vertices | |
| Mirror / subdivide | |

## UV & pixel editors

| Scenario | Pass |
|----------|------|
| UV editor opens, no `useThree` crash | |
| Texture paint updates model preview | |
| Pixel editor: layer reorder, opacity | |
| New image dialog + overwrite warning | |

## Regression notes

Record failures here:

```
Date:
Build:
Issue:
Steps:
Expected:
Actual:
```
