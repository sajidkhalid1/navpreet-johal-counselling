import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';
import {query} from '../lib/db.js';
import {passwordHash,token} from '../lib/security.js';
test('owner authorization, booking races, availability conflicts, stories and cancellation',{skip:!process.env.DATABASE_URL},async()=>{
 const oldHash=process.env.ADMIN_PASSWORD_HASH,oldOrigin=process.env.APP_ORIGIN;
 const password=token();process.env.ADMIN_PASSWORD_HASH=passwordHash(password);process.env.APP_ORIGIN='http://localhost:3000';
 const source='integration-'+token();let session='',slotId='',storyId='',bookingId='';
 async function call(path,body,authenticated=true,origin='http://localhost:3000') {const req={url:'/api/'+path,method:body?'POST':'GET',headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':source,cookie:authenticated?session:''},body:body||{}};let data,headers={};const res={statusCode:200,setHeader:(k,v)=>headers[k]=v,end:value=>data=JSON.parse(value)};await handler(req,res);return {status:res.statusCode,data,headers};}
 try {
  assert.equal((await call('admin/bookings',null,false)).status,401);
  assert.equal((await call('login',{email:process.env.ADMIN_EMAIL,password:'wrong'})).status,401);
  assert.equal((await call('login',{email:process.env.ADMIN_EMAIL,password},false,'https://other.invalid')).status,403);
  const login=await call('login',{email:process.env.ADMIN_EMAIL,password});assert.equal(login.status,200);session=login.headers['Set-Cookie'].split(';')[0];
  assert.equal((await call('me')).status,200);
  const start='2098-07-17T10:00';const added=await call('admin/slots',{localStart:start,format:'Phone',duration:15});assert.equal(added.status,200);slotId=added.data[0].id;
  assert.equal((await call('admin/slots',{localStart:start,format:'Phone',duration:15})).status,409);
  const request={slotId,name:'Website integration test',email:'test@example.invalid',phone:'',consent:true};
  const races=await Promise.all([call('book',request,false),call('book',request,false)]);assert.deepEqual(races.map(x=>x.status).sort(),[200,409]);bookingId=races.find(x=>x.status===200).data.id;
  assert.equal((await call('slots')).data.some(s=>s.id===slotId),false);
  const story=await call('admin/stories',{title:source,category:'Test',body:'Test content <script> is stored as text.',image:'',published:false});assert.equal(story.status,200);storyId=story.data[0].id;
  assert.equal((await call('stories')).data.some(s=>s.id===storyId),false);
  assert.equal((await call('admin/stories',{id:storyId,title:source,category:'Test',body:'Test content',image:'data:image/png;base64,YWJj',published:true})).status,200);
  assert.equal((await call('stories')).data.some(s=>s.id===storyId),true);
  assert.equal((await call('admin/bookings',{id:bookingId,action:'cancel'})).status,200);
  assert.equal((await call('admin/bookings')).data.find(b=>b.id===bookingId).status,'cancelled');
  assert.equal((await call('logout',{})).status,200);assert.equal((await call('me')).status,401);
 } finally {
  if(storyId)await query('DELETE FROM stories WHERE id=$1',[storyId]);
  if(slotId){await query('DELETE FROM bookings WHERE slot_id=$1',[slotId]);await query('DELETE FROM slots WHERE id=$1',[slotId]);}
  // Only synthetic test records are removed. Production records are never touched.
  process.env.ADMIN_PASSWORD_HASH=oldHash;process.env.APP_ORIGIN=oldOrigin;
 }
});
