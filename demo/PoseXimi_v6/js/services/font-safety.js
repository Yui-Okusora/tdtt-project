/** Font safety for Vietnamese interface. Run font checks before using decorative faces.
 * FontFaceSet API confirms the actual face loaded; if unavailable use safe system font.
 * Glyph coverage is not guaranteed by `document.fonts.check()`, hence ornamental fonts
 * are restricted to the Latin-only logo, while all Vietnamese UI strings use
 * Be Vietnam Pro / sans-serif fallbacks. Never apply unverified ornamental fonts
 * to user input, labels or Vietnamese headings.
 */
const decorative=['Jim Nightshade','Caesar Dressing','Honk','Nabla','Metal Mania'];
const auditState=Object.fromEntries(decorative.map(name=>[name,null]));
export function fontIsReady(name){return auditState[name]===true;}
export function fontAuditComplete(){return decorative.every(name=>auditState[name]!==null);}
export async function auditFonts(){
 const result={};
 for(const name of decorative){
  try{
   const faces=await document.fonts.load(`22px "${name}"`,'PoseXimi');
   result[name]=faces.some(face=>face.family.replace(/["']/g,'')===name&&face.status==='loaded');
   auditState[name]=result[name];
  }catch{result[name]=false;auditState[name]=false;}
 }
 // Used in the appearance picker; CSS falls back to Be Vietnam Pro when offline.
 document.documentElement.dataset.fontNetworkReady=Object.values(result).some(Boolean)?'true':'false';
 if(typeof window!=='undefined')window.dispatchEvent(new Event('poseximi-font-audit'));
 return result;
}
