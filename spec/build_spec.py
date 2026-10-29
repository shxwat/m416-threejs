#!/usr/bin/env python3
"""Deterministic builder for the Joker SMG ObjectSculptSpec.

Loads the img2threejs-generated base spec (keeps all scaffolding), samples grounded
colours from the alpha matte, and authors the full componentTree / materials /
repetitionSystems / detailInventory / featureReviewTargets, following the
trap-avoidance rules from the plan:
  * curved parts (lips, tongue, magazine) = curve-sweep, parent:null, NO attachment,
    safe role/animationRole -> real curved geometry (not forced to a straight cylinder).
  * straight tubes (suppressor, green band) = cylinder + complete attachment (cylinder
    render is correct).
  * topologyClass never paired with a disallowed primitive; teeth/void = assembled-solid.
  * materials procedural-first (no resolvable referencePbr); referencePbr gate defused
    via requiredWhenSourceImagePresent:false + acceptedLimitation.
  * root scale [1,1,1] implicit (no root component; parts attach to the factory's root
    Group), flat tree -> no non-uniform scale cascade.

Geometry lives in LAYOUT (world units, X=long axis, Y=up, Z=depth, +Z faces camera).
Re-run freely after tuning numbers.
"""
from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path

R = Path(__file__).resolve().parents[1]
SPEC = R / "spec" / "joker-smg-spec.json"
# The alpha matte used for colour sampling is not distributed with this repo;
# point REF_MATTE at your own matte image to re-run this builder.
MATTE = Path(os.environ.get("REF_MATTE", "ref_matte.png"))

# Requires the img2threejs toolchain (not included); set IMG2THREEJS to its path.
sys.path.insert(0, os.path.join(os.environ.get("IMG2THREEJS", "img2threejs"), "forge", "stage1_intake"))
from extract_pbr_evidence import load_image  # noqa: E402
from extract_part_color_recipe import srgb_to_lab, lab_to_rgba, lab_kmeans_palette  # noqa: E402

# --------------------------------------------------------------------------- #
# Colour sampling from the matte foreground within a normalized region.
# --------------------------------------------------------------------------- #
_MW, _MH, _MPX, _ = load_image(MATTE)


def _chroma_lab(lab):
    return (lab[1] ** 2 + lab[2] ** 2) ** 0.5


def sample(region, k=4, prefer="chroma"):
    """Return (dominant, secondary) rgba strings. `prefer='chroma'` picks the most
    saturated cluster as dominant (a violet/red body is defined by its hue, not by
    the dark shadow cluster that k-means share-ranks first); secondary = next distinct."""
    x0, y0, x1, y1 = region
    labs = []
    for gy in range(int(y0 * _MH), int(y1 * _MH)):
        for gx in range(int(x0 * _MW), int(x1 * _MW)):
            r, g, b, a = _MPX[gy * _MW + gx]
            if a > 16:
                labs.append(srgb_to_lab((r, g, b)))
    if not labs:
        return None
    clusters = lab_kmeans_palette(labs, k=min(k, len(labs)))
    centers = [c["center"] for c in clusters]
    if prefer == "chroma":
        centers.sort(key=_chroma_lab, reverse=True)
    dom = lab_to_rgba(centers[0])
    sec = lab_to_rgba(centers[1]) if len(centers) > 1 else dom
    return dom, sec


# Brief-grounded clean hues (reference colours with glossy shading removed). The chassis
# violet is authored magenta-leaning (R>=B) so it survives ACES tone-mapping instead of
# collapsing to flat blue (the extract_gradient_stops blue-collapse rule); refined further
# in the colour-grounding step.
FALLBACK = {
    # magenta-safe violet (R>=B) so it reads purple under ACES instead of collapsing to
    # flat blue (grimoire blue-collapse rule; confirmed risky by extract_gradient_stops).
    # Secondary carries the blue accent seen on barrel/stock.
    "glass-chassis-violet": ("rgba(148, 78, 174, 1.0)", "rgba(126, 82, 188, 1.0)"),
    "mouth-lacquer-red":    ("rgba(196, 46, 44, 1.0)", "rgba(140, 30, 46, 1.0)"),
    "teeth-enamel":         ("rgba(232, 230, 236, 1.0)", "rgba(180, 176, 188, 1.0)"),
    "suppressor-black":     ("rgba(22, 22, 30, 1.0)", "rgba(44, 44, 58, 1.0)"),
    "lime-trim":            ("rgba(126, 200, 58, 1.0)", "rgba(78, 158, 34, 1.0)"),
    "magazine-black":       ("rgba(16, 16, 26, 1.0)", "rgba(40, 34, 78, 1.0)"),
    "tongue-pink":          ("rgba(208, 85, 154, 1.0)", "rgba(165, 59, 120, 1.0)"),
    "gem-green":            ("rgba(63, 184, 74, 1.0)", "rgba(30, 122, 46, 1.0)"),
}

# Try to ground each hue against the matte; keep a sampled cluster only if it is clearly
# chromatic (avoids the glossy-dark / empty-region gray fallbacks). Otherwise use the
# brief hue. Regions are best-effort locators on the matte.
REGION = {
    "glass-chassis-violet": (0.53, 0.50, 0.60, 0.66),
    "mouth-lacquer-red":    (0.40, 0.10, 0.52, 0.22),
    "lime-trim":            (0.30, 0.44, 0.42, 0.58),
    "tongue-pink":          (0.44, 0.32, 0.50, 0.40),
}


def _chroma_of(rgba):
    n = [int(float(v)) for v in rgba[rgba.index("(") + 1:rgba.index(")")].split(",")[:3]]
    return max(n) - min(n)


# Use the clean brief-grounded hues directly (glossy-dark region sampling is unreliable
# for a dark, high-gloss subject). The chassis violet gradient is refined separately with
# extract_gradient_stops (blue-collapse check) in the colour-grounding step.
PAL = dict(FALLBACK)
print("palettes (dom / sec):")
for m, (d, s) in PAL.items():
    print(f"  {m}: {d}  {s}")

# --------------------------------------------------------------------------- #
# Load base + templates
# --------------------------------------------------------------------------- #
spec = json.loads(SPEC.read_text())
BASE_COMP = copy.deepcopy(spec["componentTree"][0])
BASE_MAT = copy.deepcopy(spec["materials"][0])

MAT_CLASS = {
    "glass-chassis-violet": "glass", "mouth-lacquer-red": "plastic",
    "teeth-enamel": "ceramic", "suppressor-black": "metal",
    "lime-trim": "plastic", "magazine-black": "plastic",
    "tongue-pink": "plastic", "gem-green": "glass",
}


def hexish(rgba):
    # rgba(r, g, b, a) -> #RRGGBB
    nums = rgba[rgba.index("(") + 1:rgba.index(")")].split(",")
    r, g, b = (int(float(n)) for n in nums[:3])
    return f"#{r:02X}{g:02X}{b:02X}"


def make_material(mid, *, roughness, metalness=0.0, clearcoat=0.0, transmission=0.0,
                  ior=1.5, env=1.0, finish="painted-metal", utility=False, overrides=None):
    m = copy.deepcopy(BASE_MAT)
    dom, sec = PAL.get(mid, ("rgba(120,120,120,1.0)", "rgba(90,90,90,1.0)"))
    dh, sh = hexish(dom), hexish(sec)
    m["id"] = mid
    m["name"] = mid.replace("-", " ").title()
    m["shaderModel"] = "MeshPhysicalMaterial"
    m["baseColor"] = dh
    m["color"] = dh
    m["albedo"] = {"dominant": dh, "secondary": [sh], "samplingNotes": "matte-region kmeans"}
    m["colorVariation"] = {"palette": [dh, sh], "pattern": "mottled",
                           "amplitude": 0.12, "heightCorrelation": 0.25}
    m["roughness"] = {"base": roughness, "variation": max(0.06, roughness * 0.3),
                      "map": "independent-procedural-field",
                      "localResponse": "cavities rougher, worn edges smoother"}
    m["metalness"] = {"base": metalness, "variation": 0.0}
    if clearcoat:
        m["clearcoat"] = {"base": clearcoat}
        m["clearcoatRoughness"] = {"base": 0.08}
    if transmission:
        m["transmission"] = {"base": transmission}
        m["ior"] = {"base": ior, "value": ior}
        m["thickness"] = {"base": 0.4}
    tp = m.setdefault("textureProjection", {})
    tp["repeat"] = [1.0, 1.0]
    m["envMapIntensity"] = env
    m["finishClass"] = finish
    m["localOverrides"] = overrides or []
    if utility:
        m["qualityTier"] = "utility"
    m["colorGradient"] = {"type": "linear", "axis": [1.0, 0.0],
                          "stops": [{"offset": 0.0, "color": dom}, {"offset": 1.0, "color": sec}]}
    return m


materials = [
    make_material("glass-chassis-violet", roughness=0.12, metalness=0.25, clearcoat=0.6,
                  env=0.7, finish="candy-coat",
                  overrides=[{"id": "chassis-clearcoat-sheen", "type": "gloss-zone",
                              "roughness": 0.08, "evidenceRefs": ["full-object"],
                              "notes": "glass-like clearcoat sheen along the body ridge"},
                             {"id": "body-swirl-linework", "type": "painted-line",
                              "evidenceRefs": ["full-object"],
                              "notes": "pink/purple filigree swirls on the receiver"}]),
    make_material("mouth-lacquer-red", roughness=0.14, clearcoat=0.8, env=1.0, finish="painted-metal",
                  overrides=[{"id": "lip-gloss-hotspot", "type": "gloss-zone", "roughness": 0.06,
                              "evidenceRefs": ["full-object"], "notes": "wet crimson lip highlight"}]),
    make_material("teeth-enamel", roughness=0.28, clearcoat=0.3, finish="plastic",
                  overrides=[{"id": "teeth-enamel-spec", "type": "gloss-zone", "roughness": 0.2,
                              "evidenceRefs": ["full-object"], "notes": "enamel sheen on square teeth"}]),
    make_material("suppressor-black", roughness=0.5, metalness=0.9, env=1.0, finish="brushed-steel",
                  overrides=[{"id": "muzzle-diamond-mark", "type": "decal", "evidenceRefs": ["full-object"],
                              "notes": "small blue diamond mark near muzzle"}]),
    make_material("lime-trim", roughness=0.35, clearcoat=0.4, env=0.9, finish="painted-metal"),
    make_material("magazine-black", roughness=0.7, metalness=0.1, finish="worn-composite",
                  overrides=[{"id": "mag-flute-shadow", "type": "groove", "evidenceRefs": ["full-object"],
                              "notes": "vertical rib flutes cast soft AO grooves"}]),
    make_material("tongue-pink", roughness=0.35, clearcoat=0.5, finish="painted-metal"),
    make_material("gem-green", roughness=0.05, clearcoat=1.0, transmission=0.85, ior=1.54,
                  env=1.0, finish="gemstone", utility=True),
]

# --------------------------------------------------------------------------- #
# Component authoring
# --------------------------------------------------------------------------- #
SAFE_ROLE = "shell"  # not in ATTACHMENT_ROLES


def recipe_for(mid):
    dom, sec = PAL.get(mid, ("rgba(120,120,120,1.0)", "rgba(90,90,90,1.0)"))
    return {
        "componentId": None, "dominantAlbedo": dom, "secondaryAlbedo": sec,
        "materialClass": MAT_CLASS.get(mid, "plastic"), "materialClassConfidence": 0.72,
        "roughnessEstimate": 0.3, "metalnessEstimate": 0.0,
        "highlightEvidence": "sampled from matte foreground region",
        "colorGradient": {"type": "linear", "axis": [1.0, 0.0],
                          "stops": [{"offset": 0.0, "color": dom}, {"offset": 1.0, "color": sec}]},
    }


def comp(cid, name, level, primitive, topo, mat, pos, scale, *, rot=(0, 0, 0),
         parent=None, attachment=None, descriptor=None, local_features=None,
         importance=0.7, role=SAFE_ROLE, anim="static", rationale=None):
    c = copy.deepcopy(BASE_COMP)
    c["id"] = cid
    c["name"] = name
    c["level"] = level
    c["role"] = role
    c["importance"] = importance
    c["confidence"] = 0.72
    c["primitive"] = primitive
    c["topologyClass"] = topo
    c["topologyRationale"] = rationale or (
        f"{name}: classified {topo} from the side-profile reference silhouette and shading.")
    if descriptor:
        c["geometryDescriptor"].update(descriptor)
    c["parent"] = parent
    c["attachment"] = attachment
    c["dimensions"] = {"width": float(scale[0]), "height": float(scale[1]),
                       "depth": float(scale[2]), "units": "relative", "confidence": 0.7}
    c["transform"] = {"position": list(pos), "rotation": list(rot), "scale": list(scale)}
    c["actionProfile"]["animationRole"] = anim
    c["actionProfile"]["destruction"]["fractureGroup"] = cid
    c["actionProfile"]["destruction"]["debrisMaterial"] = mat
    c["material"] = mat
    c["materialLayers"] = [mat]
    c["localFeatures"] = local_features or []
    c["colorMaterialRecipe"] = {**recipe_for(mat), "componentId": cid}
    c["evidenceRefs"] = ["full-object"]
    # Stage each part into the pass that first introduces its detail level so the generator's
    # per-pass level filter actually stages the build (macro silhouette -> meso sub-assemblies
    # -> micro details) instead of rendering everything at blockout.
    c["fidelityTier"] = {"macro": "blockout", "meso": "structural-pass",
                         "micro": "form-refinement"}.get(level, "blockout")
    return c


def cross_lip():
    return {"points": [[-0.06, -0.058], [0.06, -0.058], [0.078, 0.0],
                       [0.06, 0.058], [-0.06, 0.058], [-0.078, 0.0]]}


def cross_small():
    return {"points": [[-0.03, -0.02], [0.03, -0.02], [0.03, 0.02], [-0.03, 0.02]]}


def straight_attach(parent, sock, a, b, br, er):
    return {"parentId": parent, "parentSocket": sock, "localStart": list(a), "localEnd": list(b),
            "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.02,
            "baseRadius": br, "endRadius": er, "evidenceRefs": ["full-object"]}


tree = []

# ---- MACRO (all present in blockout) ----
# NOTE: receiver-core-body sits at the WORLD ORIGIN (pos 0,0,0) and its profile2D is
# authored directly in world coords. This is load-bearing: barrel-suppressor and
# muzzle-green-band are parented to it (attachment tubes), and the generator adds their
# nodes as CHILDREN — so the parent must be at the origin or the childrens' localStart/End
# compound with the parent offset (the far-left stray + wrong aspect bug). All other parts
# are parent:null (attach to the factory root at origin), also in this one world frame.
tree.append(comp("receiver-core-body", "Receiver / barrel-shroud body", "macro", "extrude",
                 "assembled-solid", "glass-chassis-violet", pos=(0.0, 0.0, 0.0),
                 scale=(1.0, 1.0, 1.0), importance=1.0, role="body",
                 descriptor={"profile2D": {"points": [[-2.60, -0.10], [1.02, -0.10], [1.02, 0.56],
                                                       [0.34, 0.70], [0.02, 0.88], [-0.5, 0.78],
                                                       [-1.25, 0.68], [-2.60, 0.62]],
                                           "depth": 0.42}},
                 local_features=[{"id": "diamond-rivet-marks"}, {"id": "rail-serration-notches"},
                                 {"id": "body-swirl-linework"}, {"id": "heart-decal"},
                                 {"id": "club-decal"}],
                 rationale="Central chassis is a discrete rigid extruded slab with flat faces."))

tree.append(comp("barrel-suppressor", "Suppressor + barrel extension", "macro", "cylinder",
                 "assembled-solid", "suppressor-black", pos=(0, 0, 0), scale=(1, 1, 1),
                 importance=0.9, role="body", parent="receiver-core-body",
                 attachment=straight_attach("receiver-core-body", "muzzle", (-3.15, 0.50, 0.0),
                                            (-2.50, 0.50, 0.0), 0.10, 0.095),
                 local_features=[{"id": "muzzle-diamond-mark"}],
                 rationale="Straight tubular suppressor — genuine cylinder swept along the bore axis."))

tree.append(comp("pistol-grip-block", "Pistol grip (blade-finned)", "macro", "extrude",
                 "assembled-solid", "magazine-black", pos=(0.28, -0.50, 0.0), scale=(1, 1, 1),
                 importance=0.85, role="body",
                 descriptor={"profile2D": {"points": [[-0.22, -0.55], [0.10, -0.58], [0.26, -0.20],
                                                       [0.22, 0.30], [-0.05, 0.34], [-0.24, 0.05]],
                                           "depth": 0.34}},
                 local_features=[{"id": "grip-stitch-x-marks"}, {"id": "grip-blade-fin"}],
                 rationale="Rigid angular grip block with flat side faces."))

tree.append(comp("stick-magazine-body", "Curved stick magazine", "macro", "curve-sweep",
                 "continuous-sculpt", "magazine-black", pos=(-0.10, -0.55, 0.0), scale=(1, 1, 1),
                 importance=0.85, role="body", anim="detach",
                 descriptor={"curveSweep": {"spine": [[-0.08, 0.55, 0.0], [0.00, 0.15, 0.0],
                                                       [0.08, -0.25, 0.0], [0.16, -0.62, 0.0]],
                                            "crossSection": {"points": [[-0.20, -0.10], [0.20, -0.10],
                                                                        [0.20, 0.10], [-0.20, 0.10]]},
                                            "closed": False}},
                 local_features=[{"id": "mag-flute-grooves"}, {"id": "mag-green-tip"}],
                 rationale="One continuous curved magazine body swept along a 3D spine."))

tree.append(comp("rear-stock-panel", "Rear wing stock", "macro", "extrude", "surface-relief",
                 "glass-chassis-violet", pos=(1.85, 0.14, 0.0), scale=(1, 1, 1), importance=0.9,
                 role="panel",
                 descriptor={"profile2D": {"points": [[-0.92, -0.30], [1.02, -0.42], [1.12, 0.30],
                                                       [0.52, 0.80], [-0.4, 0.66], [-0.92, 0.44]],
                                           "depth": 0.30}},
                 local_features=[{"id": "stock-line-art"}, {"id": "spade-decal"},
                                 {"id": "stock-gem-facets"}, {"id": "stock-scroll-linework"}],
                 rationale="Flat wing-like stock plate; relief detail on a broad thin panel."))

# ---- MESO ----
tree.append(comp("top-rail", "Serrated top rail", "macro", "box", "assembled-solid",
                 "suppressor-black", pos=(-0.55, 0.64, 0.0), scale=(1.6, 0.09, 0.34), role="panel",
                 local_features=[{"id": "rail-teeth"}],
                 rationale="Rigid boxy Picatinny-style rail atop the shroud."))
tree.append(comp("muzzle-green-band", "Muzzle green band", "meso", "cylinder", "assembled-solid",
                 "lime-trim", pos=(0, 0, 0), scale=(1, 1, 1), role="panel",
                 parent="receiver-core-body",
                 attachment=straight_attach("receiver-core-body", "band", (-3.02, 0.50, 0.0),
                                            (-2.90, 0.50, 0.0), 0.115, 0.115)))
tree.append(comp("foresight-block", "Foresight (red/purple)", "macro", "extrude", "assembled-solid",
                 "mouth-lacquer-red", pos=(-1.35, 0.56, 0.05), scale=(1, 1, 1), role="panel",
                 descriptor={"profile2D": {"points": [[-0.12, 0.0], [0.12, 0.0], [0.04, 0.42],
                                                       [-0.02, 0.30], [-0.1, 0.36]], "depth": 0.16}},
                 rationale="Angular geometric foresight, faceted flat panels."))
tree.append(comp("rear-sight-block", "Rear sight", "meso", "box", "assembled-solid",
                 "glass-chassis-violet", pos=(0.16, 0.70, 0.0), scale=(0.24, 0.30, 0.30),
                 role="panel", rationale="Small boxy rear sight riser."))
tree.append(comp("trigger-guard-loop", "Trigger guard", "meso", "torus", "assembled-solid",
                 "glass-chassis-violet", pos=(0.30, -0.02, 0.0), scale=(0.42, 0.42, 0.22),
                 role="panel", rationale="Closed loop guard ring — torus."))
tree.append(comp("mouth-void-interior", "Mouth void (dark interior)", "meso", "box",
                 "assembled-solid", "magazine-black", pos=(0.15, 0.33, 0.44),
                 scale=(1.05, 0.44, 0.10), role="panel",
                 rationale="Recessed dark cavity box behind the teeth."))
tree.append(comp("upper-lip", "Upper lip (crimson)", "macro", "curve-sweep", "continuous-sculpt",
                 "mouth-lacquer-red", pos=(0.15, 0.52, 0.56), scale=(1, 1, 1), role="shell",
                 importance=0.9,
                 descriptor={"curveSweep": {"spine": [[-0.62, -0.02, 0.0], [-0.25, 0.10, 0.02],
                                                      [0.2, 0.11, 0.02], [0.6, -0.04, 0.0]],
                                            "crossSection": cross_lip(), "closed": False}},
                 local_features=[{"id": "glossy-lip-highlight"}],
                 rationale="Continuous glossy lip ridge swept along a smiling arc."))
tree.append(comp("lower-lip", "Lower lip (crimson)", "macro", "curve-sweep", "continuous-sculpt",
                 "mouth-lacquer-red", pos=(0.15, 0.13, 0.56), scale=(1, 1, 1), role="shell",
                 importance=0.85,
                 descriptor={"curveSweep": {"spine": [[-0.55, 0.03, 0.0], [-0.15, -0.07, 0.02],
                                                      [0.2, -0.07, 0.02], [0.55, 0.05, 0.0]],
                                            "crossSection": cross_lip(), "closed": False}},
                 rationale="Continuous glossy lower lip ridge, swept arc."))
tree.append(comp("tongue", "Tongue (curling)", "meso", "curve-sweep", "continuous-sculpt",
                 "tongue-pink", pos=(-0.18, 0.20, 0.54), scale=(1, 1, 1), role="shell",
                 descriptor={"curveSweep": {"spine": [[0.12, 0.02, 0.0], [-0.06, 0.06, 0.02],
                                                      [-0.2, 0.0, 0.05], [-0.28, -0.10, 0.06]],
                                            "crossSection": cross_small(), "closed": False}},
                 rationale="Soft continuous tongue form curling out of the mouth corner."))

# ---- more MESO sub-assemblies (restore meso >= 8 floor after macro promotions) ----
tree.append(comp("stock-neck", "Stock neck / receiver joiner", "meso", "extrude", "assembled-solid",
                 "glass-chassis-violet", pos=(0.95, 0.12, 0.0), scale=(1, 1, 1), role="panel",
                 descriptor={"profile2D": {"points": [[-0.2, -0.34], [0.35, -0.28], [0.35, 0.36],
                                                      [-0.2, 0.30]], "depth": 0.36}},
                 rationale="Boxy neck bridging receiver rear to the wing stock."))
tree.append(comp("grip-blade-fin", "Grip blade fin", "meso", "extrude", "assembled-solid",
                 "glass-chassis-violet", pos=(0.14, -0.34, 0.05), scale=(1, 1, 1), role="panel",
                 local_features=[{"id": "grip-blade-fin"}],
                 descriptor={"profile2D": {"points": [[-0.06, -0.30], [0.10, -0.20], [0.14, 0.20],
                                                      [0.02, 0.16]], "depth": 0.20}},
                 rationale="Sharp angular blade-fin protruding from the grip front."))
tree.append(comp("charging-handle-nub", "Charging handle nub", "meso", "box", "assembled-solid",
                 "glass-chassis-violet", pos=(0.22, 0.72, 0.10), scale=(0.16, 0.16, 0.18),
                 role="panel", rationale="Small raised charging-handle block on the receiver top."))
tree.append(comp("front-lower-fin", "Front lower red fin", "meso", "extrude", "assembled-solid",
                 "mouth-lacquer-red", pos=(-1.5, 0.12, 0.05), scale=(1, 1, 1), role="panel",
                 descriptor={"profile2D": {"points": [[-0.16, -0.18], [0.12, -0.22], [0.18, 0.14],
                                                      [-0.06, 0.10]], "depth": 0.14}},
                 rationale="Angular red blade fin below the foresight."))

spec_components = tree

# ---- MICRO: teeth rows (individual squares; radial emitter can't do a linear arc) ----
import math


def add_teeth(prefix, count, x0, x1, ybase, yarc, z, size):
    for i in range(count):
        t = i / (count - 1)
        x = x0 + (x1 - x0) * t
        # gentle downward arc at the corners of the grin
        y = ybase - yarc * (2 * t - 1) ** 2
        spec_components.append(comp(f"{prefix}-{i}", f"Tooth {prefix} {i}", "micro", "box",
                                    "assembled-solid", "teeth-enamel", pos=(x, y, z),
                                    scale=size, role="detail", importance=0.4,
                                    rationale="Small square enamel tooth block."))


add_teeth("tooth-up", 11, -0.30, 0.62, 0.32, 0.05, 0.50, (0.055, 0.11, 0.08))
add_teeth("tooth-lo", 10, -0.26, 0.58, 0.17, -0.04, 0.50, (0.052, 0.10, 0.08))

# ---- MICRO: gems ----
spec_components.append(comp("stock-gem-green", "Stock gem (green)", "micro", "ellipsoid",
                            "surface-relief", "gem-green", pos=(2.35, -0.08, 0.17),
                            scale=(0.15, 0.22, 0.12), role="detail", importance=0.4,
                            rationale="Small faceted gem inset in the stock."))
spec_components.append(comp("grip-gem-purple", "Grip gem (purple)", "micro", "ellipsoid",
                            "surface-relief", "gem-green", pos=(0.30, -0.22, 0.19),
                            scale=(0.11, 0.15, 0.1), role="detail", importance=0.4,
                            rationale="Small faceted gem inset in the grip."))

# ---- MICRO: scattered card-suit colour accents (stylized pips on the body/stock) ----
# material-only topologyClass -> flat surface decals, no colorMaterialRecipe required.
_SUITS = [
    ("suit-heart", "mouth-lacquer-red", (0.62, 0.02, 0.44), (0.10, 0.10, 0.04)),
    ("suit-club", "lime-trim", (-1.55, 0.30, 0.44), (0.09, 0.09, 0.04)),
    ("suit-spade", "magazine-black", (2.15, -0.18, 0.31), (0.10, 0.11, 0.04)),
    ("suit-diamond", "tongue-pink", (2.45, 0.30, 0.31), (0.09, 0.11, 0.04)),
    ("suit-heart2", "mouth-lacquer-red", (-0.9, -0.02, 0.44), (0.08, 0.08, 0.04)),
]
for sid, mat, pos, scale in _SUITS:
    spec_components.append(comp(sid, sid.replace("-", " ").title(), "micro", "plane-card",
                                "material-only", mat, pos=pos, scale=scale, role="decor",
                                importance=0.3,
                                rationale="Flat card-suit colour accent riding on the surface."))

# ---- MICRO: lime-green trim edge strips (prominent green edging in the reference) ----
_TRIM = [
    ("trim-front-lower", (-1.7, -0.07, 0.44), (1.0, 0.05, 0.05)),
    ("trim-stock-edge", (2.55, -0.2, 0.30), (0.06, 0.7, 0.05)),
]
for tid, pos, scale in _TRIM:
    spec_components.append(comp(tid, tid.replace("-", " ").title(), "micro", "box",
                                "surface-relief", "lime-trim", pos=pos, scale=scale,
                                role="detail", importance=0.35,
                                local_features=[{"id": "lime-edge"}],
                                rationale="Thin lime-green trim edge strip."))

# ---- surfaceDetail on the chassis parts so surface-pass has tactile relief to gate on ----
_SURFACE = {"macroRoughness": 0.14, "microRoughness": 0.22, "bumpAmplitude": 0.03,
            "normalPattern": "fine glass micro-scatter", "displacementPattern": "",
            "occlusionPattern": "seam-cavity AO", "edgeWearPattern": "subtle bevel-crest sheen",
            "notes": "glossy clearcoat body with faint micro-normal breakup under grazing light"}
for _c in spec_components:
    if _c["id"] in ("receiver-core-body", "rear-stock-panel", "pistol-grip-block",
                    "stick-magazine-body"):
        _c["surfaceDetail"] = dict(_SURFACE)

# --------------------------------------------------------------------------- #
# Repetition system: cooling fins ring around the suppressor (radial-only emitter).
# --------------------------------------------------------------------------- #
repetition = [{
    "id": "cooling-fins-ring", "level": "meso", "parent": "receiver-core-body",
    "primitive": "box", "material": "suppressor-black", "count": 10,
    "instanceScale": [0.5, 0.06, 0.03],
    "placement": {"mode": "radial", "axis": [1, 0, 0], "radius": 0.24, "startAngleDeg": 0},
    "notes": "ribbed cooling fins wrapped around the barrel shroud axis",
}]

# --------------------------------------------------------------------------- #
# detailInventory (>=10, each mapsTo a real localFeatures/localOverrides id)
# --------------------------------------------------------------------------- #
def det(did, kind, ref, affects, scale="meso", conf=0.7):
    return {"id": did, "kind": kind, "description": f"{kind} detail: {did}",
            "region": {"x": 0.4, "y": 0.3, "width": 0.2, "height": 0.2, "units": "normalized"},
            "scale": scale, "affects": affects, "mapsTo": {"type": "link", "ref": ref},
            "evidenceRef": "full-object", "confidence": conf}


details = [
    det("lip-gloss", "gloss", "lip-gloss-hotspot", "material"),
    det("teeth-spec", "gloss", "teeth-enamel-spec", "material"),
    det("rail-serrations", "ridge", "rail-serration-notches", "geometry"),
    det("diamond-rivets", "fastener", "diamond-rivet-marks", "geometry"),
    det("body-swirls", "linework", "body-swirl-linework", "material"),
    det("heart-suit", "decal", "heart-decal", "material"),
    det("club-suit", "decal", "club-decal", "material"),
    det("spade-suit", "decal", "spade-decal", "material"),
    det("stock-lineart", "linework", "stock-line-art", "material"),
    det("mag-flutes", "groove", "mag-flute-grooves", "geometry"),
    det("grip-stitches", "stitch", "grip-stitch-x-marks", "material"),
    det("stock-gems", "bevel", "stock-gem-facets", "geometry"),
]

# --------------------------------------------------------------------------- #
# featureReviewTargets (<=5 critical / <=3 important per passId), object-specific
# --------------------------------------------------------------------------- #
frt = [
    {"id": "overall-silhouette", "name": "Overall SMG silhouette + proportions", "tier": "critical",
     "passIds": ["blockout"], "minimumScore": 0.7, "mustPass": True,
     "componentRefs": ["receiver-core-body", "barrel-suppressor", "pistol-grip-block",
                       "stick-magazine-body", "rear-stock-panel"], "evidenceRefs": ["full-object"]},
    {"id": "part-hierarchy", "name": "Sub-assembly structure + attachment", "tier": "critical",
     "passIds": ["structural-pass"], "minimumScore": 0.7, "mustPass": True,
     "componentRefs": ["mouth-void-interior", "trigger-guard-loop", "top-rail",
                       "foresight-block"], "evidenceRefs": ["full-object"]},
    {"id": "mouth-grin-motif", "name": "Grinning-mouth motif (lips/teeth/tongue)", "tier": "critical",
     "passIds": ["form-refinement"], "minimumScore": 0.68, "mustPass": True,
     "componentRefs": ["upper-lip", "lower-lip", "tongue"], "evidenceRefs": ["full-object"]},
    {"id": "chassis-glass-material", "name": "Violet glass/lacquer material response", "tier": "critical",
     "passIds": ["material-pass"], "minimumScore": 0.7, "mustPass": True,
     "componentRefs": ["receiver-core-body", "rear-stock-panel"], "evidenceRefs": ["full-object"]},
    {"id": "palette-fidelity", "name": "Joker palette (violet/red/lime/pink)", "tier": "critical",
     "passIds": ["material-pass"], "minimumScore": 0.7, "mustPass": True,
     "componentRefs": ["upper-lip", "muzzle-green-band"], "evidenceRefs": ["full-object"]},
    {"id": "card-suit-trim", "name": "Card-suit decals + gem accents", "tier": "important",
     "passIds": ["surface-pass"], "minimumScore": 0.62, "mustPass": False,
     "componentRefs": ["receiver-core-body", "rear-stock-panel", "stock-gem-green"],
     "evidenceRefs": ["full-object"]},
    {"id": "lighting-readability", "name": "Studio 3-point readability + gloss", "tier": "critical",
     "passIds": ["lighting-pass"], "minimumScore": 0.68, "mustPass": True,
     "componentRefs": ["receiver-core-body"], "evidenceRefs": ["full-object"]},
]

# --------------------------------------------------------------------------- #
# lightingFromPhoto (satisfies lighting-pass strict-quality: key/fill/rim + exposure + contact)
# --------------------------------------------------------------------------- #
lighting = [
    "key light: warm white, high front-left, ~2.2 intensity (studio softbox)",
    "fill light: cool blue, front-right, ~0.42 intensity to lift shadow side",
    "rim/environment light: neutral back rim + RoomEnvironment reflection for gloss/clearcoat",
    "exposure + tone mapping: ACES filmic, exposure ~1.0",
    "background: plain dark charcoal gradient",
    "contact shadow: soft ground shadow beneath the floating weapon",
]

# --------------------------------------------------------------------------- #
# Assemble
# --------------------------------------------------------------------------- #
spec["componentTree"] = spec_components
spec["materials"] = materials
spec["repetitionSystems"] = repetition
spec["preSpecAssessment"]["detailInventory"]["details"] = details
spec["preSpecAssessment"]["detailInventory"]["scanMethod"] = "component-zones"
spec["featureReviewTargets"] = frt
spec["lightingFromPhoto"] = lighting
spec["lookDevTargets"]["materialPass"]["referencePbrExtraction"]["requiredWhenSourceImagePresent"] = False
spec["lookDevTargets"]["materialPass"]["referencePbrExtraction"]["acceptedLimitation"] = (
    "Procedural-first reconstruction: materials use grounded palette + colorGradient + "
    "finishClass scalars via CanvasTexture, not extracted referencePbr map files.")
spec["qualityTargets"]["reviewViewpoints"] = ["side", "three-quarter", "grazing-close-up", "reference-match"]
spec["suitability"] = "conditional"
spec["silhouette"] = {
    "boundingShape": "long low bullpup SMG, ~3:1 aspect, mouth bulge on top-center",
    "aspectRatios": [3.0], "symmetry": "asymmetric side profile",
    "dominantCurves": ["smiling lip arcs", "curved magazine", "wing stock sweep"],
    "negativeSpaces": ["trigger guard loop", "open grinning mouth"],
    "landmarks": ["suppressor tip", "foresight", "grin", "grip", "stock tip"],
}

# Keep each buildPass componentRefs empty -> pure level filtering drives per-pass inclusion.
for bp in spec["buildPasses"]:
    bp["componentRefs"] = []
spec["sculptPipeline"]["passOrder"] = [p["id"] for p in spec["buildPasses"]]
spec["sculptPipeline"]["currentPass"] = "blockout"

SPEC.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n")
print(f"\nwrote {SPEC}  components={len(spec_components)} materials={len(materials)} "
      f"details={len(details)} frt={len(frt)}")
