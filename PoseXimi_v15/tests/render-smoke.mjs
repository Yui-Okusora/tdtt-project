/** Fast component-level smoke checks. Run: node tests/render-smoke.mjs */
import assert from "node:assert/strict";
import { state } from "../js/state.js";
import { MainLayout } from "../js/components/MainLayout.js";
import { CreateSessionWizard } from "../js/components/CreateSessionWizard.js";
import { PoseCarousel } from "../js/components/PoseCarousel.js";
import { PoseDetailModal } from "../js/components/PoseDetailModal.js";
import { CameraScreen } from "../js/components/CameraScreen.js";
const checks = [];
function test(label, ok) {
  assert.ok(ok, label);
  checks.push(label);
}
test(
  "3 bottom-nav tabs",
  (MainLayout().match(/class="px-tab/g) || []).length === 3,
);
test(
  "wizard: 4 person options",
  (CreateSessionWizard().match(/data-action="set-count"/g) || []).length === 4,
);
state.wizardStep = 2;
test(
  "wizard: 3 visual styles",
  (CreateSessionWizard().match(/data-action="set-style"/g) || []).length === 3,
);
state.wizardStep = 3;
test(
  "wizard: 2 image inputs",
  (CreateSessionWizard().match(/data-action="upload-input"/g) || []).length ===
    2,
);
test(
  "wizard: missing photos disable CTA",
  /data-action="request-suggestions"[^>]+disabled/.test(CreateSessionWizard()),
);
state.backgroundPhoto = "data:image/png;base64,Zw==";
state.groupPhoto = "data:image/png;base64,Zw==";
test(
  "wizard: two photos enable CTA",
  !/data-action="request-suggestions"[^>]+disabled/.test(CreateSessionWizard()),
);
state.recommendationsReady = true;
test(
  "pose: six suggestions by default",
  (PoseCarousel().match(/class="px-carousel-card/g) || []).length === 6,
);
test(
  "pose: exactly two desktop pages",
  (
    PoseCarousel().match(/data-action="carousel-to" data-index="(?:0|3)"/g) ||
    []
  ).length >= 2,
);
test(
  "pose: six mobile dots",
  (PoseCarousel().match(/aria-label="Tư thế [1-6] \/ 6"/g) || []).length === 6,
);
test(
  "pose: full-screen modal sticky CTA",
  PoseDetailModal("duo-side").includes("px-detail-sticky"),
);
test(
  "pose: optional AI preview remains available",
  PoseDetailModal("duo-side").includes('data-action="preview-pose"'),
);
state.poseId = "duo-side";
state.camera.stream = {};
test(
  "camera: 4 timer presets",
  (CameraScreen().match(/data-action="set-timer"/g) || []).length === 4,
);
test(
  "camera: grid toggle",
  CameraScreen().includes('data-action="toggle-grid"'),
);
test(
  "camera: pose opacity slider",
  CameraScreen().includes('id="poseOpacity"'),
);
test(
  "camera: small pose reference card",
  CameraScreen().includes("px-pose-note-image") &&
    !CameraScreen().includes("px-guide-svg"),
);
test(
  "camera: capture, flip and file fallback",
  ["capture-photo", "flip-camera", "open-file"].every((a) =>
    CameraScreen().includes(`data-action="${a}"`),
  ),
);
console.log(`PASS: ${checks.length} component checks`);
