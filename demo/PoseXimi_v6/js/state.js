/** Reactive shared client state, NOT a server database or user account. */
import { POSE_PRESETS } from './data.js';

export const state = {
  user: null, page: 'home', people: 2, style: 'Casual', background: 'studio',
  backgroundPhoto: null, groupPhoto: null, capturedPhoto: null,
  poseId: null, suggestions: [], showAllPoses: false, recommendationsReady: false,
  analyzing: false, libraryLoading: false, albums: [], busy: false, libraryToken: 0,
  camera: { stream: null, facing: 'user', zoom: 1, minZoom: 1, maxZoom: 1, zoomSupported: false, showPoseOverlay: true },
  inputCameraKind: null, inputCameraStream: null, fileTarget: 'group',
  pendingPreview: null, previewImage: null,
  workspaceExpanded: null,
  retakeNotes: [], retakeTitle: "", photoName: "",
};
export function poseList() {
  const key = state.people === 1 ? 'solo' : state.people === 2 ? 'duo' : state.people === 3 ? 'trio' : 'group';
  const local = POSE_PRESETS[key].map(([id, title, description, variant]) => ({id,title,description,variant}));
  // Validated server response, if available, can override ordering.
  if (!state.suggestions.length) return local;
  const byId = new Map(local.map(p=>[p.id,p]));
  const ordered = state.suggestions.map(id=>byId.get(id)).filter(Boolean);
  return [...ordered, ...local.filter(p=>!state.suggestions.includes(p.id))];
}
export function currentPose() { return poseList().find(p=>p.id===state.poseId) || null; }
export function inputsReady() { return Boolean(state.groupPhoto && state.backgroundPhoto); }
export function canEnter(page) {
  if (page==='home' || page==='library') return true;
  if (page==='poses') return inputsReady() && state.recommendationsReady;
  if (page==='capture') return Boolean(currentPose());
  if (page==='result') return Boolean(currentPose() && state.capturedPhoto);
  return false;
}
export const pageNames = {home:'Trang chủ',poses:'Gợi ý tư thế',capture:'Chụp ảnh',result:'Kết quả',library:'Thư viện'};
