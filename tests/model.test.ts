import {test} from 'node:test';
import assert from 'node:assert/strict';
import {today,period,due,emptyState,validState,type Routine} from '../src/model.ts';
import app from '../server/index.ts';
const routine:Routine={id:'1',title:'読書',frequency:'daily',weekdays:[],day:0,paused:false,created:'2026-01-01'};
test('JST switches at 15:00 UTC',()=>{assert.equal(today(new Date('2026-09-30T14:59:59Z')),'2026-09-30');assert.equal(today(new Date('2026-09-30T15:00:00Z')),'2026-10-01');});
test('weekly periods cross year and reset Monday',()=>{const r={...routine,frequency:'weekly' as const};assert.equal(period(r,'2027-01-03'),'2026-12-28');assert.equal(period(r,'2027-01-04'),'2027-01-04');});
test('month end handles February and leap years',()=>{const r={...routine,frequency:'monthly' as const,day:31};assert.equal(due(r,'2027-02-27'),false);assert.equal(due(r,'2027-02-28'),true);assert.equal(due(r,'2028-02-28'),false);assert.equal(due(r,'2028-02-29'),true);assert.notEqual(period(r,'2027-02-28'),period(r,'2027-03-01'));});
test('weekday, pause and creation constraints',()=>{assert.equal(due({...routine,weekdays:[3]},'2026-09-30'),true);assert.equal(due({...routine,weekdays:[4]},'2026-09-30'),false);assert.equal(due({...routine,paused:true},'2026-09-30'),false);assert.equal(due(routine,'2025-12-31'),false);});
test('reject invalid imports and duplicate IDs',()=>{assert.ok(validState(emptyState()));assert.equal(validState({...emptyState(),notes:[{}]}),false);assert.equal(validState({...emptyState(),routines:[routine,routine]}),false);assert.equal(validState({...emptyState(),routines:[{...routine,day:32}]}),false);});
test('production rejects unconfigured and unauthenticated access, including assets',async()=>{const env={ACCESS_DOMAIN:'https://example.cloudflareaccess.com',ACCESS_AUD:'test',OWNER_EMAIL:'me@example.com'};assert.equal((await app.request('http://localhost/api/state',{},{} as never)).status,503);assert.equal((await app.request('http://localhost/',{},env as never)).status,401);assert.equal((await app.request('http://localhost/api/state',{headers:{'Cf-Access-Jwt-Assertion':'forged'}},env as never)).status,401);});

