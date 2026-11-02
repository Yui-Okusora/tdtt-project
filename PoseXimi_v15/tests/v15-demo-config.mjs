/** Regression tests: selecting scenario ONLY in source code, no UI selector. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { UPLOAD_DEMO_SCENARIO } from "../js/config/upload-demo-scenario.js";
import { state, inputsReady } from "../js/state.js";
import { CreateSessionWizard } from "../js/components/CreateSessionWizard.js";
import { evaluateDemoPhoto } from "../js/services/input-photo-demo.js";

const all = ["technical", "both-valid", "both-invalid", "background-invalid", "group-invalid"];
assert.ok(all.includes(UPLOAD_DEMO_SCENARIO), "Unknown config scenario");
assert.equal(state.inputDemoScenario, UPLOAD_DEMO_SCENARIO, "State should use code config");
const bg = "data:image/jpeg;base64,YWJj";
const group = "data:image/jpeg;base64,ZGVm";
state.wizardStep = 3;
state.people = 2;
state.backgroundPhoto = bg;
state.groupPhoto = group;
state.inputFileValidated = { background: true, group: true };
for (const id of all) {
  state.inputDemoScenario = id; // Test only; application UI cannot switch scenario.
  const view = CreateSessionWizard();
  assert.ok(view.includes("Ảnh background") && view.includes("Ảnh của nhóm"));
  assert.ok(!view.includes('data-action="set-upload-demo"'));
  assert.ok(!view.includes("Chọn tình huống kiểm tra ảnh"));
  assert.ok(!view.includes("px-demo-panel"));
  const b = evaluateDemoPhoto("background", id, true, 2, true);
  const g = evaluateDemoPhoto("group", id, true, 2, true);
  const wantB = id === "technical" ? "technical" : ["both-invalid", "background-invalid"].includes(id) ? "invalid" : "valid";
  const wantG = id === "technical" ? "technical" : ["both-invalid", "group-invalid"].includes(id) ? "invalid" : "valid";
  assert.equal(b.status, wantB);
  assert.equal(g.status, wantG);
  assert.equal(inputsReady(), ["both-valid", "technical"].includes(id));
}
const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
assert.ok(!app.includes('case "set-upload-demo":'));
assert.ok(app.includes("UPLOAD_DEMO_SCENARIO"));
assert.ok(app.includes("decodeDemoImage"));
console.log("PASS: five scenarios, hidden controls, state config, upload flow.");
