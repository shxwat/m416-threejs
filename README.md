# Joker SMG — procedural Three.js reconstruction

A code-only, procedural Three.js reconstruction of the joker/harlequin-themed bullpup SMG
weapon skin, built with the **img2threejs** skill (`/Users/shashwat/img2threejs`). No mesh
files, no downloaded art, no original texture atlas — just a JSON `ObjectSculptSpec`, a
generated TypeScript factory, and procedural CanvasTextures.

## Result

The full staged pipeline ran end-to-end (blockout → structural → form-refinement →
material → surface → lighting → interaction → optimization), each pass reviewed against
the reference. The reconstruction reads as the joker skin: violet glossy chassis, the
central **grinning mouth** (crimson glossy lips, white square teeth, pink curling tongue,
dark void), lime-green muzzle band + trim, red foresight, navy grip/magazine/trigger-guard,
scattered card-suit colour accents, green/purple gems, and a wing stock — lit with a studio
three-point + environment setup on a dark backdrop with a soft ground shadow.

See `renders/FINAL_hero.png` and `renders/FINAL_comparison.png` (reference vs render).

## Honesty about fidelity

This is a **stylized, low-poly procedural approximation**, not a pixel-match of the AAA
promo render. A pure-procedural code reconstruction from a single image cannot reproduce the
reference's ornate filigree flourishes, smoothly-curved organic bodywork, painted gradient
shading, exact card-suit glyphs, or the elaborate stock detailing. The card suits are
stylized colour accents rather than exact heart/diamond/spade/club shapes. The identity —
silhouette, palette, grinning-mouth motif, key accents — is faithfully captured; the surface
ornamentation is suggested, not replicated.

Because the reference is exceptionally ornate, the deterministic Tier-1 silhouette IoU
plateaued around ~0.53 (vs the 0.85 target). Per the skill's own doctrine
(`grimoire/review/self_correction.md`: reconstruction-vs-procedural IoU is dominated by
ornament/framing — do not chase it), each pass was accepted on **agent-vision judgment**
against its goal, which is the skill's designated acceptance authority. Proportions and
framing match closely (aspect Δ 0.0002, scale Δ 0.018).

## View it

```bash
cd /Users/shashwat/joker-smg-skin
npm run dev            # Vite dev server at http://localhost:5173
# then open one of:
#   http://localhost:5173/?mode=hero   (studio showcase: dark bg, 3-point light, ground shadow, orbit)
#   http://localhost:5173/?mode=eval   (flat white, orthographic side — evaluation view)
#   http://localhost:5173/?mode=clay   (opaque clay — silhouette/blockout view)
```

## Files

- `spec/joker-smg-spec.json` — the ObjectSculptSpec (48 components, 8 materials, 8 reviewed passes). Strict-quality clean (0 errors / 0 warnings).
- `spec/build_spec.py` — deterministic spec builder (edit geometry/colours here, re-run to regenerate).
- `src/createJokerSmgModel.ts` — generated Three.js factory: `createJokerSMGModel()` returns a `THREE.Group` with `root.userData.sculptRuntime` (nodes/meshes/sockets/colliders/destructionGroups). Also exports `createJokerSMGLookDevLights`, `createJokerSMGEnvironment`, `frameJokerSMGCamera`, `createJokerSMGPresentationComposer`.
- `viewer/main.ts` — Vite viewer (clay / eval / hero modes).
- `viewer/shot.mjs` — headless screenshot harness (Playwright-core + cached Chromium).
- `refs/` — reference images, the alpha matte (`ref_matte.png`), and diagnostic tools (`make_matte.py`, `overlay.py`).
- `renders/` — per-pass screenshots, comparison sheets, silhouette overlays, and the finals.

## How to iterate further

Edit numbers/colours in `spec/build_spec.py`, then:
```bash
cd spec && python3 build_spec.py                                   # rebuild spec
cd /Users/shashwat/img2threejs
python3 forge/stage2_spec/validate_sculpt_spec.py <spec> --strict-quality
python3 forge/stage3_build/generate_threejs_factory.py <spec> --out <ts> --pass-id lighting-pass --force
# re-render: node viewer/shot.mjs hero renders/out.png
```
