import {Hono} from 'hono';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {validState} from '../src/model.ts';
type DB={prepare(sql:string):{bind(...v:unknown[]):{run():Promise<{meta:{changes:number}}>};first<T>():Promise<T|null>}};
type Env={DB:DB;ASSETS:{fetch(r:Request):Promise<Response>};ACCESS_DOMAIN:string;ACCESS_AUD:string;OWNER_EMAIL:string};
const app=new Hono<{Bindings:Env}>();
const keys=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
app.use('*',async(c,next)=>{const {ACCESS_DOMAIN:domain,ACCESS_AUD:aud,OWNER_EMAIL:email}=c.env;if(!domain||!aud||!email||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain))return c.text('ログイン設定が完了していません。',503);const token=c.req.header('Cf-Access-Jwt-Assertion');if(!token)return c.text('ログインが必要です。',401);try{if(!keys.has(domain))keys.set(domain,createRemoteJWKSet(new URL(domain+'/cdn-cgi/access/certs')));const {payload}=await jwtVerify(token,keys.get(domain)!,{issuer:domain,audience:aud});if(typeof payload.email!=='string'||payload.email.toLowerCase()!==email.toLowerCase())return c.text('アクセスできません。',403);}catch{return c.text('ログインを確認できません。',401);}c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');c.header('Referrer-Policy','same-origin');c.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");await next();});
app.get('/api/state',async c=>{const row=await c.env.DB.prepare('SELECT payload,revision FROM app_state WHERE id=1').first<{payload:string;revision:number}>();if(!row)return c.json({error:'Database not initialized'},503);return c.json({state:JSON.parse(row.payload),revision:row.revision});});
app.put('/api/state',async c=>{if(c.req.header('Origin')!==new URL(c.req.url).origin)return c.json({error:'Invalid origin'},403);if(!c.req.header('Content-Type')?.startsWith('application/json'))return c.json({error:'Invalid content type'},415);if(Number(c.req.header('Content-Length')||0)>2000000)return c.json({error:'Too large'},413);const raw=await c.req.text();if(new TextEncoder().encode(raw).length>2000000)return c.json({error:'Too large'},413);let input;try{input=JSON.parse(raw);}catch{return c.json({error:'Invalid JSON'},400);}if(!validState(input.state)||!Number.isInteger(input.revision))return c.json({error:'Invalid data'},400);const result=await c.env.DB.prepare('UPDATE app_state SET payload=?, revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(input.state),input.revision).run();if(!result.meta.changes)return c.json({error:'Conflict'},409);return c.json({revision:input.revision+1});});
app.all('/api/*',c=>c.json({error:'Not found'},404));
app.get('*',c=>c.env.ASSETS.fetch(c.req.raw));
app.onError((_,c)=>c.json({error:'処理に失敗しました。時間をおいて再試行してください。'},500));
export default app;

