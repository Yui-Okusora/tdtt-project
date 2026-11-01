# PoseXimi v8 — QA record

## Verified locally

- `node --check` passed for all JavaScript modules and server.mjs.
- 107 standalone assertions passed for the Home progress (0/1/2 ready), 12 style×people quick-guide combinations, 3/6 pose cards, always-available local pose preview controls, results tab state, camera countdown button, library search/filter/sort, and PWA cache paths.
- All PWA precache asset paths exist on disk.
- The new CSS references centralized palette tokens, not hard-coded colors, for main action and selected states.
- Updated `manifest.webmanifest` parses as JSON and identifies PoseXimi v8.

## Not verified / pending device testing

- Chromium E2E: the runtime browser reports `net::ERR_BLOCKED_BY_ADMINISTRATOR` when opening `localhost`, even though direct HTTP requests to the Node server succeed.
- Camera capture, flip, zoom, countdown behavior in actual user hardware, full rendering of all 19 palettes and 9 fonts, VoiceOver/TalkBack and cross-device layout need manual tests.
- Account privacy isolation, registration concurrency and production authentication were not addressed by this UX iteration.
- AI image composition and real-time pose quality scoring are not available until a compliant backend is connected.
