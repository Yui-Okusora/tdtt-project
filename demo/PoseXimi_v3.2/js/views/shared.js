/** Reusable headings, progress stepper and album image layout. */
import { state } from '../state.js';import { safe } from '../ui.js';
export function steps(){
 const names=['Cấu hình','Chọn pose','Chụp ảnh','Hoàn tất'];
 const idx={home:0,poses:1,capture:2,result:3,library:3}[state.page]??0;
 return `<div class="step-track" aria-label="Tiến trình">${names.map((name,i)=>`${i?'<span class="step-line"></span>':''}<span class="step ${i===idx?'active':i<idx?'done':''}"><span class="step-index">${i<idx?'✓':i+1}</span>${safe(name)}</span>`).join('')}</div>`;
}
export function heading(eyebrow,title,desc,{progress=true}={}){
 return `<div class="page-head"><div><span class="eyebrow">${safe(eyebrow)}</span><h1>${title}</h1><p>${safe(desc)}</p></div>${progress?steps():''}</div>`;
}
export function photoGrid(photos,classname){return `<div class="${safe(classname)} ${photos.length===1?'one-photo':''}">${photos.map((photo,i)=>`<img src="${photo}" alt="Ảnh ${i+1}" loading="lazy" />`).join('')}</div>`}
