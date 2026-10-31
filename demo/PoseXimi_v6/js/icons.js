/** PoseXimi v4 icon registry.
 * Tabler official webfont (online) + inline SVG fallback (PWA offline).
 * Names follow the official Tabler icon catalog. Fallback SVGs use Tabler's
 * 24x24 / 2px / rounded stroke visual conventions, not icon font glyphs.
 * No network is required for the fallback icons.
 */
const P={
 'camera':'<path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2H4a2 2 0 0 1 -2 -2V9a2 2 0 0 1 2 -2z"/><circle cx="12" cy="13" r="3.5"/>',
 'library-photo':'<path d="M6 4h13a2 2 0 0 1 2 2v13a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2z"/><path d="M2 17V5a3 3 0 0 1 3 -3h12"/><circle cx="15" cy="9" r="1.5"/><path d="M6 17l4 -4l3 3l3 -3l4 4"/>',
 'lock-square-rounded':'<rect x="3" y="3" width="18" height="18" rx="4"/><rect x="8" y="11" width="8" height="7" rx="1"/><path d="M10 11V9a2 2 0 0 1 4 0v2"/>',
 'logout-2':'<path d="M10 5H6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h4"/><path d="M13 8l4 4l-4 4"/><path d="M9 12h8"/>',
 'trash':'<path d="M4 7h16M10 4h4M6 7l1 14h10l1 -14M10 11v6M14 11v6"/>',
 'cloud-download':'<path d="M7 18H6a4 4 0 0 1 -1 -8a7 7 0 0 1 13 -2a5 5 0 0 1 0 10h-1"/><path d="M12 12v9m-4 -4l4 4l4 -4"/>',
 'camera-off':'<path d="M2 2l20 20"/><path d="M5 7h2l2 -2h6l2 2h3a2 2 0 0 1 2 2v9"/><path d="M20 20H4a2 2 0 0 1 -2 -2V9"/><path d="M9.2 10.2a4 4 0 0 0 4.6 5.6"/>',
 'image-in-picture':'<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 8h.01M2 16l5 -5l3 3"/><rect x="12" y="11" width="8" height="7" rx="1"/>',
 'graph-off':'<path d="M3 3l18 18"/><path d="M3 17l4 -4l4 3l5 -7l4 4"/><path d="M3 21h18"/>',
 'arrow-badge-right':'<path d="M12 3l9 9l-9 9H6a3 3 0 0 1 -3 -3V6a3 3 0 0 1 3 -3h6z"/><path d="M8 12h9m-4 -4l4 4l-4 4"/>',
 'arrow-badge-left':'<path d="M12 3l-9 9l9 9h6a3 3 0 0 0 3 -3V6a3 3 0 0 0 -3 -3h-6z"/><path d="M16 12H7m4 -4l-4 4l4 4"/>',
 'arrow-badge-down':'<path d="M3 12l9 9l9 -9V6a3 3 0 0 0 -3 -3H6a3 3 0 0 0 -3 3v6z"/><path d="M12 8v9m-4 -4l4 4l4 -4"/>',
 'checkbox':'<path d="M9 5H5a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-8"/><path d="M9 11l3 3l9 -9"/>',
 'eye-spark':'<path d="M3 12c2 -4 5 -6 9 -6s7 2 9 6c-2 4 -5 6 -9 6s-7 -2 -9 -6z"/><circle cx="12" cy="12" r="2.5"/><path d="M19 1v4m-2 -2h4"/>',
 'cloud-upload':'<path d="M7 18H6a4 4 0 0 1 -1 -8a7 7 0 0 1 13 -2a5 5 0 0 1 0 10h-1"/><path d="M12 21v-9m-4 4l4 -4l4 4"/>',
 'sparkles':'<path d="M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8 -5.2L3 9l5.2 -1.8z"/><path d="M19 14l1 2l2 1l-2 1l-1 2l-1 -2l-2 -1l2 -1z"/>',
 'login-2':'<path d="M10 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-6"/><path d="M4 12h10m-4 -4l4 4l-4 4"/>',
 'home':'<path d="M3 11l9 -8l9 8v9a1 1 0 0 1 -1 1H4a1 1 0 0 1 -1 -1z"/><path d="M9 21v-8h6v8"/>',
 'photo':'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="M3 17l5 -5l4 3l3 -3l6 6"/>',
 'menu-2':'<path d="M4 6h16M4 12h16M4 18h16"/>'
};
const ACTION={
 'upload-input':'cloud-upload','camera-input':'camera','request-suggestions':'sparkles',
 'toggle-more':'arrow-badge-down','preview-pose':'eye-spark','select-pose':'checkbox',
 'back-home':'arrow-badge-left','go-camera':'arrow-badge-left','open-file':'cloud-upload',
 'open-camera':'camera','capture-photo':'camera','stop-camera':'camera-off',
 'toggle-pose-overlay':'image-in-picture','go-results':'arrow-badge-right',
 'retake':'arrow-badge-left','approve':'checkbox','view-album':'eye-spark',
 'download-album':'cloud-download','delete-album':'trash','confirm-delete':'trash',
 'retry-preview':'sparkles','take-input-photo':'camera'
};
/** HTML icon markup, backed up by local SVG; Tabler webfont is optional. */
export function iconMarkup(name){
 const id=Object.hasOwn(P,name)?name:'photo';
 return `<span class="px-icon" data-tabler-name="${id}" aria-hidden="true"><i class="ti ti-${id}"></i><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M0 0h24v24H0z" stroke="none"/>${P[id]}</svg></span>`;
}
/** Replacing only icon glyphs keeps existing labels, click handlers and layout. */
export function decorateIcons(root=document){
 root.querySelectorAll('button[data-action],button#logoutBtn,button#loginSubmit,button#sidebarToggle').forEach(btn=>{
   let name=btn.id==='logoutBtn'?'logout-2':btn.id==='loginSubmit'?'login-2':btn.id==='sidebarToggle'?'menu-2':ACTION[btn.dataset.action];
   if(btn.dataset.action==='toggle-pose-overlay'){
     name=btn.getAttribute('aria-pressed')==='true'?'graph-off':'image-in-picture';
   }
   if(!name)return;
   btn.querySelector(':scope > .px-icon')?.remove();
   btn.insertAdjacentHTML('afterbegin',iconMarkup(name));
   btn.classList.add('has-tabler-icon');
 });
 root.querySelectorAll('.camera-placeholder .big-camera,.empty-view .empty-icon').forEach(el=>{el.innerHTML=iconMarkup(el.matches('.big-camera')?'camera':'library-photo')});
}

// Enable the original Tabler webfont only after its stylesheet actually loads.
const webfont=typeof document!=='undefined'?document.getElementById('tabler-webfont'):null;
if(webfont){
 const verifyTablerFont=async()=>{
   try{
     // A stylesheet may load while its icon font fails; never hide SVG fallbacks
     // until the actual Tabler font has loaded successfully.
     const faces=await document.fonts.load('18px "tabler-icons"');
     if(faces.some(face=>face.status==='loaded'&&face.family.replace(/["']/g,'').toLowerCase()==='tabler-icons')){
       document.documentElement.classList.add('tabler-webfont-ok');
     }
   }catch{/* keep the local SVG fallback */}
 };
 webfont.addEventListener('load',verifyTablerFont);
 if(webfont.sheet)verifyTablerFont();
}
