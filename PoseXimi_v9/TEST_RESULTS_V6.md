# PoseXimi_v6 — Test results

## Verified
- CSS parser: no syntax errors in `css/palette-feedback.css`.
- Computed CSS in headless Chromium using the actual project styles embedded in a test page (not the full application): 19 palettes × 5 branded surfaces = 95 cases pass (gradient background and white foreground). Additional Rose/Ocean/Lilac comparisons confirm distinct colors for install button, completed/current steps, toast, PWA banner, its action button, success notice, network badge and status pill.
- HTTP local server with alternate `PORT=5606` returns the new CSS file with 200 OK. Default 5500 was in use by another local process during testing.
- HTML stylesheet load order and service worker precache entry verified.
- `node --check` succeeded on `sw.js` and `js/services/appearance.js`.

## Not verified
- Full app integration in Chromium through localhost: this environment returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` when automated Chromium tried to open the localhost URL. Real device/browser testing should be performed by the user after installation.
- PWA installation prompt availability depends on browser and platform; only its CSS was modified.

## Scope
Only new palette feedback CSS and references/version/docs were changed; application JS logic, camera, login and library remain the same as v5.
