/** PoseXimi v10 smoke tests: no browser, camera permission, or network required. */
import assert from "node:assert/strict";
import { state, poseList } from "../js/state.js";
import { CameraScreen } from "../js/components/CameraScreen.js";
import { renderResult } from "../js/views/result.js";
import { renderLibrary } from "../js/views/library.js";
import {
  normalizePhotoTitle,
  validatePhotoTitle,
  filenameFromTitle,
} from "../js/services/photo-title.js";

const passed = [];
function check(name, fn) {
  fn();
  passed.push(name);
}
state.people = 2;
state.style = "Casual";
state.poseId = poseList()[0].id;
check("camera note has a small illustrated pose", () => {
  const html = CameraScreen();
  assert.match(html, /class="px-pose-note"/);
  assert.match(html, /px-pose-note-image/);
  assert.match(html, /pose-illustration/);
  assert.doesNotMatch(html, /px-pose-guide|px-guide-svg/);
});
check("camera supports toggling note", () => {
  state.camera.stream = {};
  state.camera.showPoseOverlay = false;
  const html = CameraScreen();
  assert.doesNotMatch(html, /class="px-pose-note"/);
  assert.match(html, /Hiện pose/);
  state.camera.showPoseOverlay = true;
  state.camera.stream = null;
});
check("camera photo is not composited with the pose reference", () => {
  state.capturedPhoto = "data:image/jpeg;base64,dGVzdA==";
  const html = CameraScreen();
  assert.doesNotMatch(html, /class="px-pose-note"/);
  state.capturedPhoto = null;
});
check("result asks for a title before saving", () => {
  state.capturedPhoto = "data:image/jpeg;base64,dGVzdA==";
  state.photoTitle = "Kỉ niệm ♥";
  const html = renderResult();
  assert.match(html, /id="photoTitle"/);
  assert.match(html, /value="Kỉ niệm ♥"/);
  assert.match(html, /Lưu ảnh vào thư viện/);
});
check("photo names normalize Vietnamese whitespace", () =>
  assert.equal(
    normalizePhotoTitle("  Nhóm   bạn \n tháng 11 "),
    "Nhóm bạn tháng 11",
  ),
);
check("empty title is rejected", () =>
  assert.match(validatePhotoTitle("  "), /đặt tên/),
);
check("long title is rejected", () =>
  assert.match(validatePhotoTitle("a".repeat(61)), /60/),
);
check("valid Vietnamese name is allowed", () =>
  assert.equal(validatePhotoTitle("Ảnh nhóm ✨"), ""),
);
check("download filenames do not contain reserved characters", () =>
  assert.equal(
    filenameFromTitle("Buổi chụp: bạn/bè?"),
    "Buổi chụp- bạn-bè-.jpg",
  ),
);
check("download keeps uploaded image extension", () =>
  assert.equal(
    filenameFromTitle("Ảnh mới", "demo", "data:image/png;base64,AA=="),
    "Ảnh mới.png",
  ),
);
check("library shows new album titles and keeps old albums readable", () => {
  state.libraryLoading = false;
  state.libraryFilter = "all";
  state.librarySort = "newest";
  state.librarySearch = "";
  state.albums = [
    {
      id: "new",
      title: "Nhóm bạn lớp tôi",
      poseTitle: "High five",
      createdAt: 100,
      photos: ["data:image/png;base64,dA=="],
      style: "Casual",
      people: 2,
    },
    {
      id: "old",
      poseTitle: "Pose số 1",
      createdAt: 10,
      photos: ["data:image/png;base64,dA=="],
      style: "Fashion",
      people: 1,
    },
  ];
  const html = renderLibrary();
  assert.match(html, /Nhóm bạn lớp tôi/);
  assert.match(html, /Pose số 1/);
});
console.log(`${passed.length}/${passed.length} checks passed`);
passed.forEach((x, i) => console.log(`${i + 1}. ${x}`));
