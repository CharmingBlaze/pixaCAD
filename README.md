# pixaCAD

Browser-based low-poly 3D editor for game assets and textured models. Built with React, Three.js, and Zustand.

## Requirements

- Node.js 18+
- npm 9+

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:e2e` | Build + Playwright smoke tests |
| `npm run test:e2e:headed` | Build + Playwright smoke tests (headed) |

## Project files

- **Save / load:** `.pixacad.json` (app id `pixacad`, version 2) — includes theme, weld settings, and scene state
- **Legacy:** still opens older `.khed.json` files saved by the previous app id
- **Import / export:** OBJ (+ MTL/textures), GLTF/GLB (+ textures), STL
- **Autosave:** IndexedDB autosave every 2 minutes; **File → Open Recent** restores the latest autosave

## Edit modes & shortcuts

| Key | Action |
|-----|--------|
| `1`–`4` | Object / Vertex / Edge / Face mode |
| `G` | Move (translate gizmo in sub-object modes) |
| `E` | Extrude (faces or edges) |
| `I` | Inset faces (face mode) |
| `K` | Knife tool |
| `Del` | Delete selection |
| `Esc` | Cancel knife / extrude / poly draw (first press); clear selection (second) |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` | Redo |
| `Ctrl/Cmd+C` / `V` | Copy / paste object(s) |
| `Ctrl/Cmd+S` | Save project (browser download) |

**Status bar:** Wireframe overlay, snap-to-grid toggle, vertex/edge snap toggle, grid size (default `0.01` for vertex work).

**Themes:** **Theme** menu in the top bar — 98 color schemes (Classic is default). Your choice is saved in the browser and in project files.

**UV Editor:** Mark UV seams on edges (edge mode → **UV Seam**), then unwrap with **Seams** mode. Adjust atlas **Pad** padding in the toolbar.

**Poly draw:** Toggle the Poly Draw button (or Esc to finish). Place vertices for tri/quad faces, or Enter / click the first point to close a polygon. Stays active so you can keep adding faces to the same mesh.

**Knife:** Two clicks on the same face (snaps to vertices and edge midpoints). Tool exits after a successful cut; press `K` again for another cut.

## Manual QA

See [docs/QA.md](docs/QA.md) for the full release checklist.

## Release gate

Before release, run automated gates in this order:

```bash
npm test
npm run build
npm run test:e2e
```

## Known limitations

- Large textures inflate project JSON size.
- Main bundle is ~1.4 MB (UV/Pixel editors are lazy-loaded; core bundle is still large).
- Knife cuts work on planar face geometry; extreme non-planar quads may fail.
- Seam unwrap uses planar island projection (not LSCM/angle-based).
- Beta quality: report issues with steps to reproduce.

## License

MIT — see [LICENSE](LICENSE).
