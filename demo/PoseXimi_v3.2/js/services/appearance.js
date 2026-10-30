/**
 * PoseXimi DESIGN SYSTEM — single configuration file for palettes and font pairs.
 * Add a theme here; no need to edit CSS/layout files or individual pages.
 * Palette objects define CSS custom property values applied to <html>.
 */
const gradient=(a,b,c)=>`linear-gradient(115deg, ${a}, ${b}, ${c})`;
const buttonGradient=(a,b)=>`linear-gradient(110deg, ${a}, ${b})`;

export const PALETTES = [
  {
    id:'rose',label:'Rose Cream',swatches:['#8c2044','#f9e4eb','#fffdfa'],
    tokens:{accent:'#8c2044',accentStrong:'#711835',surface:'#fffdfa',surfaceSoft:'#faeaf0',
      page:'#fbf7f4',text:'#342129',textSoft:'#89787e',stroke:'#eadbdb',
      hero:gradient('#f9e3e8','#f8eae8','#f4d9df'),
      login:'linear-gradient(148deg,#b44d72,#923557,#762641)',
      button:buttonGradient('#9a2850','#7d1c3d'),heroInk:'#78213d'}
  },
  {
    id:'lilac',label:'Dreamy Lilac',swatches:['#6752af','#e7dff8','#fcfaff'],
    tokens:{accent:'#6752af',accentStrong:'#443184',surface:'#fcfaff',surfaceSoft:'#ece5ff',
      page:'#f8f6ff',text:'#302844',textSoft:'#817491',stroke:'#e2d9ef',
      hero:gradient('#eee7ff','#f9f2fc','#e1d8f9'),
      login:'linear-gradient(148deg,#8570c8,#6955b0,#453483)',
      button:buttonGradient('#8462c2','#59449f'),heroInk:'#514090'}
  },
  {
    id:'matcha',label:'Matcha Studio',swatches:['#496a57','#e0ede0','#fbfcf5'],
    tokens:{accent:'#496a57',accentStrong:'#2d5140',surface:'#fbfcf5',surfaceSoft:'#e4f0e4',
      page:'#f6f9f3',text:'#263c31',textSoft:'#6c8475',stroke:'#d8e4d8',
      hero:gradient('#e1eddc','#f5f8e9','#dbeacf'),
      login:'linear-gradient(148deg,#6d9678,#496f59,#2f5541)',
      button:buttonGradient('#62866b','#365b43'),heroInk:'#31543a'}
  },
  {
    id:'apricot',label:'Apricot Pop',swatches:['#a74e42','#ffe2cf','#fff9f1'],
    tokens:{accent:'#a74e42',accentStrong:'#81362f',surface:'#fffaf4',surfaceSoft:'#ffe9da',
      page:'#fff8f2',text:'#482d28',textSoft:'#967770',stroke:'#eeddd1',
      hero:gradient('#ffeadc','#fff7ed','#f8d6c7'),
      login:'linear-gradient(148deg,#d78167,#bb6553,#8d413d)',
      button:buttonGradient('#bd6954','#994539'),heroInk:'#893c35'}
  },
  {
    id:'ocean',label:'Ocean Breeze',swatches:['#167d9d','#9ee7e2','#e9f9fc'],
    tokens:{accent:'#167d9d',accentStrong:'#095d7b',surface:'#f9feff',surfaceSoft:'#dff5f5',
      page:'#f2fbff',text:'#193c49',textSoft:'#5e8693',stroke:'#cfe5e8',
      hero:gradient('#a3e9e8','#d8fbf2','#b1d8f7'),
      login:'linear-gradient(135deg,#198fb3,#2874b3,#2b426e)',
      button:buttonGradient('#209db2','#235a9e'),heroInk:'#134f71'}
  },
  {
    id:'sunset',label:'Sunset Sorbet',swatches:['#cb535e','#ffc38d','#ffe5b4'],
    tokens:{accent:'#bf5360',accentStrong:'#953546',surface:'#fffdfa',surfaceSoft:'#ffe9d6',
      page:'#fff9f1',text:'#533039',textSoft:'#99717c',stroke:'#f0ddcd',
      hero:gradient('#ffb3bc','#ffcfb0','#fff0c3'),
      login:'linear-gradient(140deg,#d25380,#ef9b6d,#d45c55)',
      button:buttonGradient('#d76876','#b14466'),heroInk:'#97394e'}
  },
  {
    id:'aurora',label:'Aurora Mint',swatches:['#438d84','#a7c6f8','#e4dbfb'],
    tokens:{accent:'#438d84',accentStrong:'#256e71',surface:'#fbfefc',surfaceSoft:'#e4f3f0',
      page:'#f5fafb',text:'#263f48',textSoft:'#6d8386',stroke:'#d7e6e5',
      hero:gradient('#c2f5df','#b8e9f6','#e7d0ff'),
      login:'linear-gradient(145deg,#4cbaa3,#598dbe,#896ca6)',
      button:buttonGradient('#40a5a0','#5d79a8'),heroInk:'#30567e'}
  },
  {
    id:'berry',label:'Berry Galaxy',swatches:['#8c378e','#db8bc7','#f6dbf0'],
    tokens:{accent:'#8c378e',accentStrong:'#6b236c',surface:'#fffafd',surfaceSoft:'#f8e4f4',
      page:'#fdf6fc',text:'#4d2c4b',textSoft:'#987c96',stroke:'#efdbeb',
      hero:gradient('#e4bef1','#ffd5e7','#e5d4fb'),
      login:'linear-gradient(140deg,#702b9c,#b94b91,#d678a8)',
      button:buttonGradient('#af4b9e','#7b368d'),heroInk:'#703675'}
  },
  {
    id:'cocoa',label:'Cocoa Latte',swatches:['#805344','#d5aa8b','#f3eadb'],
    tokens:{accent:'#805344',accentStrong:'#5e382f',surface:'#fffcf7',surfaceSoft:'#f3e6d7',
      page:'#faf5ef',text:'#3d302b',textSoft:'#83736b',stroke:'#e8dbce',
      hero:gradient('#f1d8c1','#eec9c0','#f9ead6'),
      login:'linear-gradient(140deg,#aa796a,#7c5147,#5e3a3b)',
      button:buttonGradient('#a66c56','#75473a'),heroInk:'#6d433c'}
  }
];

// Font pair selection. If you add a new Google Font, also add its stylesheet link
// to index.html (or self-host WOFF2 for PWA offline use).
export const FONTS = [
  {id:'original',label:'Gốc – Jakarta + DM Sans',body:"'DM Sans',sans-serif",heading:"'Plus Jakarta Sans',sans-serif",brand:"'Plus Jakarta Sans',sans-serif"},
  {id:'sweet',label:'Dễ thương – Coiny + Quicksand',body:"'Quicksand',sans-serif",heading:"'Quicksand',sans-serif",brand:"'Coiny',cursive"},
  {id:'editorial',label:'Nghệ thuật – Bricolage + Be Vietnam Pro',body:"'Be Vietnam Pro',sans-serif",heading:"'Bricolage Grotesque',sans-serif",brand:"'Bricolage Grotesque',sans-serif"},
  {id:'fashion',label:'Thời trang – Fraunces + Be Vietnam Pro',body:"'Be Vietnam Pro',sans-serif",heading:"'Fraunces',serif",brand:"'Fraunces',serif"},
];

const TOKEN_NAMES={accent:'--accent',accentStrong:'--accent-strong',surface:'--surface',surfaceSoft:'--surface-soft',
  page:'--page',text:'--text-main',textSoft:'--text-soft',stroke:'--stroke',
  hero:'--hero-gradient',login:'--login-gradient',button:'--button-gradient',heroInk:'--hero-ink'};
const KEY='poseximi-appearance-v1';
const pick=(items,id)=>items.find(item=>item.id===id)||items[0];

export function getAppearance(){
  try {const value=JSON.parse(localStorage.getItem(KEY)||'{}');
    return {palette:pick(PALETTES,value.palette).id,font:pick(FONTS,value.font).id};
  } catch {return {palette:'rose',font:'original'};}
}
/** Persist settings and atomically update all CSS tokens, without touching layout. */
export function setAppearance(choice){
  const previous=getAppearance();
  const palette=pick(PALETTES,choice.palette??previous.palette);
  const font=pick(FONTS,choice.font??previous.font);
  const html=document.documentElement;
  html.dataset.palette=palette.id;
  html.dataset.font=font.id;
  for (const [name,varName] of Object.entries(TOKEN_NAMES)) html.style.setProperty(varName,palette.tokens[name]);
  html.style.setProperty('--font-body',font.body);
  html.style.setProperty('--font-heading',font.heading);
  html.style.setProperty('--font-brand',font.brand);
  localStorage.setItem(KEY,JSON.stringify({palette:palette.id,font:font.id}));
  return {palette:palette.id,font:font.id};
}
export function initAppearance(){return setAppearance(getAppearance());}
