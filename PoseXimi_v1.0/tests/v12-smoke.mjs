/** v12 focused regression: no browser required. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {state,poseList} from '../js/state.js';
import {PoseCarousel} from '../js/components/PoseCarousel.js';
import {CameraScreen} from '../js/components/CameraScreen.js';
import {createSignupValidation} from '../js/services/signup-validation.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(resolve(root,file),'utf8');
let total=0;function test(name,assertion){assert.ok(assertion,name);total++;console.log(`PASS ${name}`)}
const html=read('index.html');
test('Authentication header kept from v6',html.includes('Chụp một kiểu')&&html.includes('Đủ hiểu đẹp trai')&&html.includes('Chụp một thế đẹp, đẹp một thế hệ'));
test('Registration header kept from v6',html.includes('Một tài khoản.')&&html.includes('Ngàn khoảnh khắc.'));
test('Actual Polaroids from v6 are preserved', (html.match(/assets\/guide\/jojo-2\.webp/g)||[]).length===2&&(html.match(/assets\/guide\/jojo-3\.webp/g)||[]).length===2);
test('Signup validation feedback stays below each field', ['signupUsernameError','signupEmailError','signupPasswordError','signupConfirmError'].every(id=>html.includes(`id="${id}"`)));
test('Signup rules are discoverable and collapsed by default',html.includes('id="signupRuleGuide"')&&!html.includes('id="signupRuleGuide" open'));
test('Login has no signup strength rules',!html.slice(html.indexOf('id="loginView"'),html.indexOf('id="signupView"')).includes('data-signup-rule'));
state.backgroundPhoto='data:image/png;base64,Zw==';state.groupPhoto='data:image/png;base64,Zw==';state.recommendationsReady=true;
for(let people=1;people<=4;people++){
 state.people=people;state.poseIndex=0;
 const pose=PoseCarousel();
 test(`Six pose cards in group ${people}`,(pose.match(/class="px-carousel-card/g)||[]).length===6&&poseList().length===6);
}
const markup=PoseCarousel();
test('2 desktop page dots', (markup.match(/aria-label="Trang [12] \/ 2"/g)||[]).length===2);
test('6 mobile dots', (markup.match(/aria-label="Tư thế [1-6] \/ 6"/g)||[]).length===6);
test('There is no extra click to show poses',!markup.includes('data-action="toggle-more"'));
test('Carousel per-page step is responsive',read('js/app.js').includes("(min-width:851px)")&&read('js/app.js').includes('direction*per'));
test('Desktop CSS fits three cards per page',read('css/v12-integration.css').includes('calc((100% - 32px)/3)')&&read('css/v12-integration.css').includes('nth-child(3n+1)'));
state.people=2;state.poseId=poseList()[0].id;state.camera.stream={};
const camera=CameraScreen();
test('Pure shutter is a blank circle',camera.includes('px-shutter-clean')&&camera.includes('px-shutter-core')&&!camera.includes('showcase-person'));
test('Keep the corner pose note and hardware actions', camera.includes('px-pose-note')&&['capture-photo','open-file','flip-camera'].every(a=>camera.includes(`data-action="${a}"`)));
const picker=read('js/views/appearance-picker.js');
test('Palette and font cards share the same layout',picker.includes('px-theme-picker')&&picker.includes('px-font-picker'));
test('No dropdowns in the new picker',!picker.includes('paletteDropdown')&&!picker.includes('fontDropdown'));
test('PWA includes the v12 CSS',read('sw.js').includes('./css/v12-integration.css')&&read('sw.js').includes('poseximi-v12-'));
// signup blur rule: valid fields do not show any warning before blur.
const fields={};for(const id of ['signupUsername','signupEmail','signupPassword','signupConfirm'])fields[id]={value:'',attrs:{},listeners:{},classList:{toggle(k,on){fields[id].invalid=on}},addEventListener(k,cb){this.listeners[k]=cb},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},getAttribute(k){return this.attrs[k]},focus(){this.focused=true}};
const results={};for(const id of Object.keys(fields))results[id+'Error']={hidden:true,textContent:''};
const labels={};for(const key of ['username','email','length','uppercase','confirm'])labels[key]={textContent:'',classList:{toggle(){}}};
const fakeDoc={getElementById:id=>fields[id]??results[id],querySelector:q=>labels[q.match(/data-signup-rule="([^"]+)"/)?.[1]]};
const validate=createSignupValidation(fakeDoc);
validate.update();
test('Pristine signup form has no red errors',Object.values(results).every(f=>f.hidden));
fields.signupUsername.value='x';fields.signupUsername.listeners.blur();
test('Username warning appears after blur only',!results.signupUsernameError.hidden&&fields.signupUsername.invalid);
fields.signupUsername.value='valid_name';fields.signupUsername.listeners.input();
test('Editing clears the error until next blur',results.signupUsernameError.hidden);
fields.signupUsername.listeners.blur();
test('Valid username stays clear after blur',results.signupUsernameError.hidden);
console.log(`${total}/${total} v12 smoke checks passed`);
