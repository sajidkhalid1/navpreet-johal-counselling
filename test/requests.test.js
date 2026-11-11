import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';
import {query} from '../lib/db.js';
import {passwordHash,token} from '../lib/security.js';
import {validWindow} from '../lib/appointments.js';
test('availability ranges must produce whole one-hour slots on one valid date',()=>{
 assert.ok(validWindow('2030-05-01T12:00','2030-05-01T16:00'));
 assert.ok(validWindow('2030-05-01T12:30','2030-05-01T16:30'));
 for(const [start,end] of [['2030-05-01T12:00','2030-05-01T12:30'],['2030-05-01T12:00','2030-05-02T12:00'],['2030-02-30T12:00','2030-02-30T16:00'],['2030-05-01T16:00','2030-05-01T12:00']])assert.ok(!validWindow(start,end));
});
test('calendar requests, approval, reminders, rejection, cancellation, and journal access',{skip:!process.env.DATABASE_URL},async()=>{
 const oldHash=process.env.ADMIN_PASSWORD_HASH,oldOrigin=process.env.APP_ORIGIN,oldDelivery=process.env.EMAIL_DELIVERY_ENABLED;const password=token();
 process.env.EMAIL_DELIVERY_ENABLED='false';
 process.env.ADMIN_PASSWORD_HASH=passwordHash(password);process.env.APP_ORIGIN='http://localhost:3000';
 const source='integration-'+token();let session='',slots=[],storyId='';
 async function call(path,body,authenticated=true,origin='http://localhost:3000'){
  const req={url:'/api/'+path,method:body?'POST':'GET',headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':source,cookie:authenticated?session:''},body:body||{}};let data;const headers={};const res={statusCode:200,setHeader:(k,v)=>headers[k]=v,end:value=>data=JSON.parse(value)};await handler(req,res);return {status:res.statusCode,data,headers};
 }
 try{
  assert.equal((await call('admin/bookings',null,false)).status,401);
  assert.equal((await call('login',{email:process.env.ADMIN_EMAIL,password:'wrong'})).status,401);
  assert.equal((await call('login',{email:process.env.ADMIN_EMAIL,password},false,'https://other.invalid')).status,403);
  const login=await call('login',{email:process.env.ADMIN_EMAIL,password});assert.equal(login.status,200);session=login.headers['Set-Cookie'].split(';')[0];
  const day=new Date(Date.now()+180*86400000).toISOString().slice(0,10);const minute=String(Math.floor(Math.random()*60)).padStart(2,'0');
  const window={localStart:day+'T10:'+minute,localEnd:day+'T14:'+minute,format:'Online'};
  const added=await call('admin/slots',window);assert.equal(added.status,200,JSON.stringify(added.data));slots=added.data.map(s=>s.id);assert.equal(slots.length,4);
  const publicSlots=(await call('slots',null,false)).data.filter(s=>slots.includes(s.id));assert.equal(publicSlots.length,4);assert.ok(publicSlots.every(s=>new Date(s.ends_at)-new Date(s.starts_at)===3600000&&s.local_date===day));
  assert.equal((await call('admin/slots',window)).status,409);
  const request={slotId:slots[0],name:'Synthetic appointment test',email:'test@example.invalid',phone:'',service:'couples',consent:true};
  assert.equal((await call('book',{...request,service:'invalid'},false)).status,400);
  const races=await Promise.all([call('book',request,false),call('book',request,false)]);assert.deepEqual(races.map(x=>x.status).sort(),[200,409]);
  const booked=races.find(x=>x.status===200).data;assert.equal(booked.status,'pending');assert.equal((await call('slots',null,false)).data.some(s=>s.id===slots[0]),false);
  assert.equal((await call('admin/bookings',{id:booked.id,action:'approve',connectionDetails:'Synthetic meeting details'})).status,200);
  assert.equal((await call('admin/bookings',{id:booked.id,action:'approve'})).status,409);
  const jobs=await query('SELECT kind,send_at,status FROM email_jobs WHERE request_id=$1 ORDER BY send_at',[booked.id]);assert.equal(jobs.length,3);assert.deepEqual(new Set(jobs.map(j=>j.kind)),new Set(['confirmation','reminder_day','reminder_hour']));
  const start=new Date(booked.starts_at);assert.equal(start-new Date(jobs.find(j=>j.kind==='reminder_day').send_at),86400000);assert.equal(start-new Date(jobs.find(j=>j.kind==='reminder_hour').send_at),3600000);
  assert.equal((await call('admin/bookings',{id:booked.id,action:'cancel',reopen:false})).status,200);
  assert.ok((await query("SELECT status FROM email_jobs WHERE request_id=$1 AND kind<>'cancellation'",[booked.id])).every(j=>j.status==='cancelled'));
  const second=await call('book',{...request,slotId:slots[1],service:'individual'},false);assert.equal(second.status,200);
  assert.equal((await call('admin/bookings',{id:second.data.id,action:'decline',reopen:true})).status,200);
  assert.equal((await call('slots',null,false)).data.some(s=>s.id===slots[1]),true);
  const story=await call('admin/stories',{title:source,category:'Test',body:'Test content <script> stored safely as text.',image:'/assets/quiet-room.jpg',published:false,isSample:true});assert.equal(story.status,200);storyId=story.data[0].id;
  assert.equal((await call('stories',null,false)).data.some(s=>s.id===storyId),false);
  assert.equal((await call('admin/stories',{id:storyId,title:source,category:'Test',body:'Test content',image:'/assets/quiet-room.jpg',published:true,isSample:true})).status,200);
  assert.equal((await call('stories',null,false)).data.find(s=>s.id===storyId).is_sample,true);
  assert.equal((await call('logout',{})).status,200);assert.equal((await call('me')).status,401);
 }finally{
  if(storyId)await query('DELETE FROM stories WHERE id=$1',[storyId]);
  if(slots.length){const windows=await query('SELECT DISTINCT window_id FROM appointment_slots WHERE id=ANY($1::uuid[])',[slots]);await query('DELETE FROM email_jobs WHERE request_id IN(SELECT id FROM appointment_requests WHERE slot_id=ANY($1::uuid[]))',[slots]);await query('DELETE FROM appointment_requests WHERE slot_id=ANY($1::uuid[])',[slots]);await query('DELETE FROM appointment_slots WHERE id=ANY($1::uuid[])',[slots]);for(const w of windows)if(w.window_id)await query('DELETE FROM appointment_windows WHERE id=$1',[w.window_id]);}
  process.env.ADMIN_PASSWORD_HASH=oldHash;process.env.APP_ORIGIN=oldOrigin;if(oldDelivery===undefined)delete process.env.EMAIL_DELIVERY_ENABLED;else process.env.EMAIL_DELIVERY_ENABLED=oldDelivery;
 }
});
