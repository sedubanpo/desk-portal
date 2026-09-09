import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../../docs/student-gender-icons.js', import.meta.url), 'utf8');
function setup() {
 const context = {console}; vm.createContext(context); vm.runInContext(source,context);
 const callbacks = {}, errors = {}; let stopped = 0;
 context.StudentGenderIcons.start({collection(name) { return {onSnapshot(ok,err) { callbacks[name]=ok;errors[name]=err;return ()=>stopped++; }}; }});
 return {api:context.StudentGenderIcons, send(name,rows) {callbacks[name]({docs:rows.map(r=>({id:r.id,data:()=>r}))});},errors,stopped:()=>stopped};
}
test('authoritative gender and newest shared asset; omitted unknown or duplicate names',()=>{
 const s=setup();
 s.send('students',[{id:'a',name:'가학생',gender:'male'},{id:'b',name:'나학생',gender:'female'},{id:'c',name:'미선택'},{id:'d',name:'동명이인',gender:'male'},{id:'e',name:'동명이인',gender:'female'}]);
 s.send('sharedIconAssets',[{id:'old',lookupKey:'student-gender:male',imageUrl:'https://example.org/old.png',updatedAt:1},{id:'new',lookupKey:'student-gender:male',imageUrl:'https://example.org/new.png',updatedAt:2},{id:'student-gender:female',imageUrl:'https://example.org/f.png'}]);
 assert.match(s.api.render('가학생'),/new.png/); assert.match(s.api.render('나학생'),/f.png/);
 assert.doesNotMatch(s.api.render('미선택'),/<img/); assert.doesNotMatch(s.api.render('동명이인'),/<img/);
 assert.match(s.api.render('동명이인','e'),/여학생/);
 s.send('students',[{id:'a',name:'가학생',gender:''}]); assert.doesNotMatch(s.api.render('가학생'),/<img/);
 s.api.stop();assert.equal(s.stopped(),2); assert.doesNotMatch(s.api.render('나학생'),/<img/);
});
test('escapes names, rejects unsafe assets and updates asset URL',()=>{
 const s=setup();s.send('students',[{id:'a',name:'<학생>',gender:'male'}]);
 s.send('sharedIconAssets',[{id:'student-gender:male',imageUrl:'javascript:alert(1)'}]);
 assert.doesNotMatch(s.api.render('<학생>'),/<img|<학생>/);
 s.send('sharedIconAssets',[{id:'student-gender:male',imageUrl:'https://example.org/v2.png'}]);assert.match(s.api.render('<학생>'),/v2.png/);
 s.errors.sharedIconAssets();assert.doesNotMatch(s.api.render('<학생>'),/<img/);
});
test('old subscription callbacks cannot repopulate icons after logout',()=>{
 const s=setup();s.api.stop();
 s.send('students',[{id:'a',name:'가학생',gender:'male'}]);
 s.send('sharedIconAssets',[{id:'student-gender:male',imageUrl:'https://example.org/a.png'}]);
 assert.doesNotMatch(s.api.render('가학생'),/<img/);
});
