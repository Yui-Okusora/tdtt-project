/** Pose selection. Preview calls real AI backend; it never pretends a local overlay is AI. */
import {state,poseList} from '../state.js';import {poseSVG} from '../art.js';import {safe} from '../ui.js';import {heading} from './shared.js';
export function renderPoses(){
 if(state.analyzing)return `${heading('POSE SUGGESTIONS','Đang tìm gợi ý…','Đang phân tích cấu hình và tìm các pose ưu tiên.')}<div class="loading-view" role="status"><div class="loading-spinner"></div><strong>Đang tải gợi ý tư thế</strong><p>Vui lòng không đóng trang.</p></div>`;
 const ranked=poseList();const shown=state.showAllPoses?ranked:ranked.slice(0,3);
 return `${heading('','Gợi ý tư thế',`${state.people} người · ${state.style} · Chọn một mẫu để chụp.`)}
 <div class="filter-bar"><span class="filter-hint">${state.suggestions.length?'✓ Xếp hạng từ backend':''}</span><span class="tag-chip">${state.people} người · ${safe(state.style)}</span></div>
 <div class="pose-grid">${shown.map((p,i)=>`<article class="pose-card ${state.poseId===p.id?'chosen':''}">${poseSVG(state.people,p.variant,state.background,state.style)}<div class="pose-meta"><div class="pose-topline"><h3></h3><span class="mini-badge">${i<3?'TOP '+(i+1):'MORE'}</span></div><p></p><div class="pose-actions"><button class="btn btn-outline" type="button" data-action="preview-pose" data-id="${safe(p.id)}">Xem trước</button><button class="btn btn-primary" type="button" data-action="select-pose" data-id="${safe(p.id)}">Chọn pose</button></div></div></article>`).join('')}</div>
 <div class="more-pose-row"><button class="btn btn-outline" type="button" data-action="toggle-more">${state.showAllPoses?'Thu gọn':'Xem thêm 3 tư thế'}</button><button class="btn btn-soft" type="button" data-action="back-home">Đổi ảnh đầu vào</button></div>`;
}
