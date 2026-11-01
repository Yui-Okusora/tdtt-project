# PoseXimi_v6 — Palette-synced UI feedback

Base: PoseXimi_v5 (theme/font picker fix). Changes only:

1. `css/palette-feedback.css` new override for install CTA, stepper check circles, toast, PWA update and informational notices, driven by existing theme variables.
2. `index.html` links new stylesheet after all other local CSS.
3. `sw.js` cache version bumped and new stylesheet included.
4. `manifest.webmanifest`, `README.md` updated to v6.

No JS workflow changes; login, pose selection, camera and gallery unchanged. Error/danger messages retain semantic colors.
