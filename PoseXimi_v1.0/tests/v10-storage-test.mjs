/** Offline fallback regression: if IndexedDB is unavailable, titled images remain visible and deletable. */
import assert from 'node:assert/strict';
const map=new Map();
globalThis.window={indexedDB:null};
globalThis.localStorage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
const {storeAlbum,readAlbums,deleteAlbum}=await import('../js/services/storage.js');
const album={id:'demo-001',title:'Kỉ niệm nhóm 3',poseTitle:'Pose mẫu',createdAt:123,photos:['data:image/png;base64,AA==']};
await storeAlbum(album);
const saved=await readAlbums();
assert.equal(saved.length,1);assert.equal(saved[0].title,'Kỉ niệm nhóm 3');
await deleteAlbum(album.id);
assert.equal((await readAlbums()).length,0);
console.log('PASS: IndexedDB fallback can store, read, and delete a named photo.');
