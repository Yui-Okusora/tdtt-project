# PoseXimi v8 — UI/UX Audit and Research Plan

**Date:** 2026-11-01  
**Basis:** Local PoseXimi_v7 source bundled in this package, prior v6 audit, official documentation and product references below. This is an expert heuristic review, not a validated usability study with participants. No production AI, camera-device or cloud-storage capabilities are claimed.

## 1. Current capabilities, by stage

| Stage             | Exists                                                                                                | UX friction to address                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Sign in / Sign up | Username/password login, validation on blur and guest mode                                            | Too much visual decoration, limited password visibility and account recovery; ensure effective error guidance          |
| Home              | Choose 1–4 people, matching style illustration, Casual/Fashion/JoJo, background + group photo uploads | Too many full-height cards for simple decisions; primary value (poses) is discovered late; status of readiness unclear |
| Pose selection    | 3 presets, expand to 6, optional AI preview                                                           | Preview becomes an error when AI backend is absent; no always-working larger view                                      |
| Camera            | Responsive camera, overlay pose, flip/zoom, upload, retake hints                                      | Main live feed is embedded in card chrome; insufficient hands-free capture; need better mobile ergonomics              |
| Result            | Side-by-side photo and pose sample, Retake and Approve                                                | On mobile the comparison requires vertical scroll; static tips cannot imply AI assessment                              |
| Library           | Local IndexedDB photos, view, download, delete, loading and empty states                              | No search/sort/style filtering; previous audit identifies account-isolation and fallback-consistency risks             |
| Appearance & PWA  | 19 palettes, 9 font sets, install, offline shell                                                      | Too many expressive fonts/gradients can reduce consistency; enforce readable Vietnamese and accessibility tokens       |

## 2. External product references and transferable patterns

1. **SOVS / SOVS2 pose guidance** — Uses pose outlines on a live camera and miniature reference images. Transfer: overlay opacity and quick show/hide sample, not a large separate template panel. Source: [PetaPixel](https://petapixel.com/2019/02/09/this-app-uses-a-camera-overlay-as-a-guide-for-instagram-worthy-poses/). Historical reference, not a claim about its current release.
2. **Ulike** — Historical pose guidance examples show a silhouette superimposed over camera output. Transfer: user learns by seeing their own pose and outline simultaneously, not by reading instructions. Source: [Niusnews](https://www.niusnews.com/=P0nanab9). Historical reference.
3. **B612** — Emphasizes live capture and quick access to effects/filters. Transfer: large camera viewfinder, minimal top controls, bottom shutter controls. Source: [App Store](https://apps.apple.com/vn/app/b612-ai-photo-video-editor/id904209370).
4. **Photoroom** — Source image -> automatically process -> review/edit -> export and AI backgrounds with suggestions. Transfer: explicit upload, processing feedback, editing recovery and end result. Sources: [Photoroom Help: Background Remover](https://help.photoroom.com/en/articles/16033415-how-to-use-background-remover) and [AI Backgrounds](https://help.photoroom.com/en/articles/6741465-how-to-use-ai-backgrounds).
5. **Pinterest** — Save-to-board and organized visual exploration. Transfer: gallery sorting/filtering and user-created collections or favorites. Sources: [Pinterest board organization](https://help.pinterest.com/en/article/organize-your-boards) and [Pinterest Newsroom](https://newsroom.pinterest.com/news/pinterest-boards-get-ai-powered-upgrade-for-personalized-experience/).

These are pattern references, not designs to copy verbatim or assets for redistribution.

## 3. UX principles used

- **Visibility of system status:** show how many uploads are ready and distinguish real AI operations from local examples. [NN/g 10 Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- **Progressive disclosure:** show essentials initially; place advanced/rare controls deeper without hiding critical navigation. [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- **Contextual help:** rather than lengthy onboarding screens, show pose corrections next to the camera and error instructions by their fields. [NN/g Mobile Onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/)
- **Larger touch controls:** a 44–48 px practical design target on touch devices; WCAG 2.2 AA has a 24 px target-size minimum with exceptions. [Android Accessibility](https://support.google.com/accessibility/android/answer/7101858) and [W3C WCAG](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)

## 4. Implemented in this v8 frontend UX pass

- Home readiness indicator (0/2, 1/2, 2/2) and contextual explanation.
- One bottom CTA that remains actionable; if an input is missing, point to the missing image instead of silently disabling the next step.
- Rename upload action to **Thay ảnh** after a successful upload.
- Always-working offline **Xem mẫu** modal for each pose; AI composition is a separate optional action.
- Camera hands-free 3-second countdown.
- Mobile result tabs for comparing **Ảnh của bạn / Pose mẫu** without long scrolling.
- Library search, filter by style, sort by date and empty-filter feedback.
- New focused CSS with palette-aware colors, reduced desktop/mobile chrome, keyboard focus, touch targets, reduced motion, compact mobile hero.

## 5. High-priority follow-up items requiring deeper changes

1. **Privacy and account isolation (P0):** Scope IndexedDB albums by authenticated owner, separate guest library, migrate legacy albums conservatively, and validate access on any future cloud API. Prototype backend is not production-ready.
2. **Safe registration (P0):** Move multi-user account storage from file read-modify-write to transactional DB and add rate limiting, password-reset support, CSRF and secure session practices appropriate to deployment.
3. **Real AI (P1):** API contract for suggestions, preview and quality assessment, with progress, cancellation, retries, server-side quotas, image retention consent and privacy disclosures.
4. **Image upload UX (P1):** Source quality validator, resolution feedback, rotation correction and actual person-count/full-body CV checks only after reliable model integration; never claim frontend verifies whole bodies.
5. **Accessibility (P1):** Formal WCAG contrast auditing across all 19 palettes, VoiceOver/TalkBack labels, keyboard modal focus trap and screen-reader live regions.
6. **Polished portfolio and favorites (P2):** Favorites, tags, collections, undo delete and downloads through native share sheet when available.
7. **User research:** Test with 5–8 first-time participants on iOS and Android, including denied camera permissions and slow-network scenarios. Record actual time-to-first-pose, task success, errors, and subjective usability, not guessed metrics.

## 6. Suggested testing script for the lecturer

- Ask 5 untrained users to enter as Guest and reach a pose without help.
- Repeat with an invalid photo (over 10 MB or shorter side below 480 px).
- Ask users to preview a pose without backend and explain what it shows.
- On phone, grant and deny camera, use the 3-second timer, hide/show pose overlay, retake after photo.
- Compare final image with pose, save, filter to Fashion, then download and delete.
- Change a gradient palette and body font; verify Vietnamese diacritics and colored selected/disabled states.
- Test at 390×844, 320×568, 768×1024 and desktop; check zoom, keyboard and WCAG contrast.
- Before deploying publicly, resolve P0 data privacy/auth issues and secure all personal photo assets.

## 7. Three-screen design direction

- **Home:** compact welcome banner, progress indicator, 1–4 people segmented selection, small quick-guide thumbnail, style selector, two upload cards, a single contextual CTA.
- **Pose:** image-led visual grid with large tap targets; see larger sample instantly and select; backend preview is an enhancement, not a dead-end.
- **Camera:** viewport occupies 70–80% of screen height, pose picture-in-picture, thumb-reachable shutter/flip/3-second timer, guidance after retake.

Do not add ornamental animations, modals or walkthroughs simply to increase the feature count: favor task clarity and predictable recovery.
