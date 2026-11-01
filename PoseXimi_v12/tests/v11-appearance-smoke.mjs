import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const dir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let stored=new Map();
globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,String(v))};
const props=new Map();
const html={dataset:{},style:{setProperty:(k,v)=>props.set(k,v)}};
const meta={setAttribute:(k,v)=>props.set(k,v)};
globalThis.document={documentElement:html,querySelector:selector=>selector==='meta[name="theme-color"]'?meta:null,getElementById:()=>null};
const {FONTS,PALETTES,getAppearance,setAppearance}=await import('../js/services/appearance.js');
const {renderAppearancePicker}=await import('../js/views/appearance-picker.js');
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS',name)};
test('Exactly 19 palettes / 9 original v6 font presets',()=>{
 assert.equal(PALETTES.length,19);
 assert.equal(FONTS.length,9);
 assert.deepEqual(FONTS.map(f=>f.id),['original','sweet','editorial','fashion','nightshade','caesar','honk','nabla','metal']);
});
test('Initial appearance uses safe v10 editorial default',()=>assert.equal(getAppearance().font,'editorial'));
test('Font chooser contains 9 font options',()=>{
 const markup=renderAppearancePicker();
 assert.equal((markup.match(/data-font-choice=/g)||[]).length,9);
 assert.equal((markup.match(/data-palette-choice=/g)||[]).length,19);
 assert.ok(markup.includes('px-font-picker'));
 assert.ok(markup.includes('px-theme-picker'));
});
test('Sweet preset changes actual v9 CSS variables',()=>{
 setAppearance({font:'sweet'});
 assert.equal(html.dataset.font,'sweet');
 assert.match(props.get('--px-font-body'),/Quicksand/);
 assert.match(props.get('--px-font-display'),/Quicksand/);
 assert.match(props.get('--font-brand'),/Coiny/);
 assert.equal(getAppearance().font,'sweet');
});
test('Change palette without resetting font',()=>{
 setAppearance({palette:'ocean'});
 assert.equal(getAppearance().font,'sweet');
 assert.equal(html.dataset.palette,'ocean');
 assert.equal(props.get('--accent'),'#167d9d');
});
test('Preserve migrated v10 stored studio choice',()=>{
 stored.set('poseximi-appearance-v1',JSON.stringify({palette:'rose',font:'studio'}));
 assert.equal(getAppearance().font,'editorial');
});
test('Every decorative font keeps accented UI text on Be Vietnam Pro',()=>{
 for(const f of FONTS.filter(f=>['nightshade','caesar','honk','nabla','metal'].includes(f.id))){
  assert.match(f.body,/Be Vietnam Pro/);
  assert.match(f.heading,/Be Vietnam Pro/);
 }
});
test('The v9 hardcoded design font lock is removed',()=>{
 const css=fs.readFileSync(resolve(dir,'css/design-tokens.css'),'utf8');
 assert.match(css,/--px-font-body: var\(--font-body/);
 assert.match(css,/--px-font-display: var\(--font-heading/);
 assert.match(css,/\.px-brand strong \{font-family:var\(--font-brand/);
});
test('v6 selection artwork is restored without removing v10 images',()=>{
 const wizard=fs.readFileSync(resolve(dir,'js/components/CreateSessionWizard.js'),'utf8');
 assert.match(wizard,/px-v6-style-icon/);
 assert.match(wizard,/assets\/guide\/\$\{name\.toLowerCase\(\)\}/);
 for(const style of ['casual','fashion','jojo'])assert.ok(fs.existsSync(resolve(dir,`assets/style-${style}.png`)));
});
console.log(`${count}/${count} v11 appearance smoke checks passed`);
