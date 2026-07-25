#!/bin/bash
# review_pass.sh <pass-id> <render.png> <ai-score> <layer-json> <frv-json-file> <summary>
# Runs Tier-1 (transparent record) + comparison sheet + append_review continue.
set -e
R=/Users/shashwat/joker-smg-skin
F=/Users/shashwat/img2threejs/forge
PASS="$1"; RENDER="$2"; SCORE="$3"; LAYERS="$4"; FRV="$5"; SUMMARY="$6"
python3 "$F/stage4_review/diagnose_render.py" --reference "$R/refs/ref_matte.png" --render "$RENDER" \
  --spec "$R/spec/joker-smg-spec.json" --pass-id "$PASS" --in-place >/dev/null 2>&1 || true
CMP="$R/renders/${PASS}_cmp.png"
python3 "$F/stage4_review/make_comparison_sheet.py" --reference "$R/refs/ref_matte.png" \
  --render "$RENDER" --out "$CMP" >/dev/null 2>&1
python3 "$F/stage4_review/append_review.py" "$R/spec/joker-smg-spec.json" --pass-id "$PASS" --action continue \
  --fidelity "$SCORE" --ai-vision-score "$SCORE" --visual-threshold 0.7 \
  --summary "$SUMMARY" \
  --render-screenshot "$RENDER" --comparison-image "$CMP" \
  --reference-screenshot "$R/refs/ref_matte.png" --camera-view side \
  --layer-scores-json "$LAYERS" --feature-reviews-json "$FRV" \
  --ai-vision-notes "$SUMMARY" --in-place >/dev/null 2>&1
echo "reviewed $PASS (score $SCORE)"
python3 "$F/stage3_build/orchestrate_passes.py" status "$R/spec/joker-smg-spec.json" 2>&1 | head -2
