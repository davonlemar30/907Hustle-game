const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const ui=fs.readFileSync(path.join(__dirname,'..','ui.jsx'),'utf8');
test('active shell labels v0.4 and loads v2 presentation',()=>{assert.match(ui,/Alpha v0\.4/);assert.match(html,/src="\.\/ui\.jsx"/);assert.match(ui,/C\.SAVE_KEY/)});
test('HUD keeps survival and operation state visible',()=>{for(const label of ['Day','Area','Cash','Debt','Health','Heat','Cargo','Garage'])assert.match(ui,new RegExp(`k="${label}"`))});
test('navigation exposes market-first operation shell',()=>{for(const label of ['Market','Travel','Operation','People','Cash + Dre','Services'])assert.ok(ui.includes(label),label)});
test('approved base crew relationship and combat surfaces are wired',()=>{for(const text of ['North Star Garage','Protected storage','Gear store','Mara Velez','Crew ·','encounterChoices','RESOLVE_ENCOUNTER','Choose your background','Final plan'])assert.match(ui,new RegExp(text))});
test('trade controls retain multi-item visit and exact quantity controls',()=>{assert.match(ui,/Prices stay fixed until you close the market/);assert.match(ui,/>−5</);assert.match(ui,/>\+5</);assert.match(ui,/>MAX</);assert.match(ui,/type:'END_MARKET'/)});
test('primary controls keep the 44px mobile target and six-column nav',()=>{assert.match(html,/\.btn \{ min-height:44px/);assert.match(html,/\.nav button \{[^}]*min-height:48px/);assert.match(html,/grid-template-columns:repeat\(6/)});
test('day summary has presentation priority over a scheduled encounter',()=>{assert.match(ui,/!state\.run\.daySummary&&state\.run\.pendingEncounter/)});
