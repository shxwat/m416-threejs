# M416 Glacier — procedural Three.js weapon studio

An interactive 3D studio for a stylized M416-style rifle, built with **Three.js**, **TypeScript** and **Vite**. The model is generated entirely in code — no mesh files and no image textures; surface detail comes from procedural canvas textures.

**Live demo:** https://m416-threejs.vercel.app

## Features

- **Skin presets** — Glacier (translucent ice), FDE Tan, Stealth and Neon.
- **Exploded view** — pull the rifle apart into its components and reassemble it.
- **Firing and reload** — single shots with recoil, ejected casings and projectiles, an auto-fire mode, and a reload animation.
- **Attachment toggles** — foregrip, iron sights and STANAG magazine.
- **Camera presets** — Hero, Side, Muzzle and Stock, plus free orbit.
- **Slow-mo and auto-orbit** toggles, and a live FPS readout.

## Controls

| Input | Action |
|---|---|
| Drag / scroll | Orbit / zoom |
| `E` | Explode / assemble |
| `Space` | Fire |
| `F` | Toggle auto-fire |
| `R` | Reload |
| `O` | Toggle auto-orbit |
| `C` | Change camera preset |

## Run locally

```bash
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # production build in dist/
```

## Files

- `src/createJokerSmgModel.ts` — the procedural model factory (geometry, materials, skin presets, canvas textures). The file name is left over from an earlier prototype; it builds the M416 Glacier model.
- `viewer/main.ts` — scene, lighting, UI wiring, firing/explode animations.
- `viewer/shot.mjs` — headless screenshot helper (Playwright); expects a local Chromium install.
- `renders/` — screenshots of the model at various stages of development.
- `spec/` — data files from an earlier procedural-modelling pipeline. They are kept for reference only, are not used by the app, and `spec/build_spec.py` needs an external toolchain that is not included here.

## License

MIT
