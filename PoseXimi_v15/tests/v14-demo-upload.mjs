/** PoseXimi v14: test simulated photo input validation without an AI backend. */
import assert from "node:assert/strict";
import { state, inputsReady } from "../js/state.js";
import {
  evaluateDemoPhoto,
  DEMO_SCENARIOS,
} from "../js/services/input-photo-demo.js";
import { CreateSessionWizard } from "../js/components/CreateSessionWizard.js";
import fs from "node:fs";
let passed = 0;
const t = (name, fn) => {
  fn();
  console.log("PASS", name);
  passed++;
};
const bg = "data:image/jpeg;base64,YWJj";
const group = "data:image/jpeg;base64,ZGVm";
const good = "valid",
  bad = "invalid";
state.wizardStep = 3;
state.people = 3;
state.backgroundPhoto = bg;
state.groupPhoto = group;
state.inputFileValidated = { background: true, group: true };
for (const scenario of DEMO_SCENARIOS) {
  state.inputDemoScenario = scenario.id;
  const b = evaluateDemoPhoto(
    "background",
    scenario.id,
    true,
    state.people,
    true,
  );
  const g = evaluateDemoPhoto("group", scenario.id, true, state.people, true);
  t(`Scenario ${scenario.id} independent background verdict`, () =>
    assert.equal(
      b.status,
      scenario.id === "technical"
        ? "technical"
        : scenario.id === "both-invalid" || scenario.id === "background-invalid"
          ? bad
          : good,
    ),
  );
  t(`Scenario ${scenario.id} independent group verdict`, () =>
    assert.equal(
      g.status,
      scenario.id === "technical"
        ? "technical"
        : scenario.id === "both-invalid" || scenario.id === "group-invalid"
          ? bad
          : good,
    ),
  );
  t(`Scenario ${scenario.id} gates continue`, () =>
    assert.equal(
      inputsReady(),
      ["both-valid", "technical"].includes(scenario.id),
    ),
  );
  t(`Scenario ${scenario.id} renders two photo tiles and both results`, () => {
    const html = CreateSessionWizard();
    assert.equal((html.match(/class="px-upload-tile /g) || []).length, 2);
    assert.equal((html.match(/px-demo-result-heading/g) || []).length, 2);
    assert.ok(!html.includes("Chọn tình huống kiểm tra ảnh"));
    assert.ok(!html.includes('type="checkbox"'));
    assert.ok(!html.includes('data-action="set-upload-demo"'));
  });
}
state.inputDemoScenario = "technical";
t("Normal mode calls out technical-only checks", () => {
  assert.equal(
    evaluateDemoPhoto("group", "technical", true, 3, true).status,
    "technical",
  );
  assert.equal(inputsReady(), true);
});
state.inputFileValidated.background = false;
t("Switching from demo to normal mode does not falsely certify a file", () => {
  state.inputDemoScenario = "technical";
  assert.equal(inputsReady(), false);
  assert.equal(
    evaluateDemoPhoto("background", "technical", true, 3, false).status,
    "unchecked",
  );
});
state.inputDemoScenario = "both-valid";
state.groupPhoto = null;
t("Missing group never passes even in forced-valid demo", () =>
  assert.equal(inputsReady(), false),
);
t("Missing group says please upload", () =>
  assert.equal(
    evaluateDemoPhoto("group", "both-valid", false, 3).status,
    "empty",
  ),
);
state.groupPhoto = group;
t("Group invalid guides user to see full body and expected count", () => {
  const result = evaluateDemoPhoto("group", "group-invalid", true, 3);
  assert.match(result.detail, /3 người/);
  assert.match(result.instruction, /toàn thân/);
});
t("Background invalid explicitly says no people in scene", () => {
  assert.match(
    evaluateDemoPhoto("background", "background-invalid", true).instruction,
    /không có người/,
  );
});
t("File input uses demo decoder only for initial setup photos", () => {
  const s = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.ok(s.includes("decodeDemoImage(file)"));
  assert.ok(s.includes("await decodeFile(file)"));
});
t("Demo functions are explicitly scoped and clearly labeled", () => {
  const code = fs.readFileSync(
    new URL("../js/services/input-photo-demo.js", import.meta.url),
    "utf8",
  );
  assert.ok(code.includes("NOT inferred from pixels"));
});
console.log(`${passed}/${passed} v14 demo checks passed`);
