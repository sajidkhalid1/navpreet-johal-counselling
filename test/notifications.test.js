import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emailPayload,processEmailJobs} from '../lib/notifications.js';
import {publishWindow,requestAppointment,reviewRequest} from '../lib/appointments.js';
import {query} from '../lib/db.js';
test('confirmation content uses Mountain Time, escapes contact details, and includes a one-hour calendar event',()=>{
 const before=process.env.EMAIL_FROM;process.env.EMAIL_FROM='Practice <appointments@example.invalid>';
 const payload=emailPayload({kind:'confirmation',name:'<script>',email:'delivered@resend.dev',request_id:'example-reference',starts_at:'2025-01-10T19:00:00Z',ends_at:'2025-01-10T20:00:00Z',send_at:'2025-01-01T12:00:00Z',format:'Online',connection_details:'Meet here <safe> & ready'},Date.parse('2025-01-01T12:00:00Z'));
 assert.ok(payload.html.includes('&lt;script&gt;'));assert.ok(!payload.html.includes('Hello <script>'));
 assert.match(payload.text,/12(?:[.:]00)?/);assert.ok(payload.text.includes('MST'));assert.ok(payload.text.includes('1 hour'));assert.ok(!payload.scheduled_at);
 const calendar=Buffer.from(payload.attachments[0].content,'base64').toString();assert.ok(calendar.includes('DTSTART:20250110T190000Z'));assert.ok(calendar.includes('DTEND:20250110T200000Z'));
 process.env.EMAIL_FROM=before;
});
test('provider scheduling is idempotent and cancelling an appointment cancels its future reminders',{skip:!process.env.DATABASE_URL},async()=>{
 const previous={RESEND_API_KEY:process.env.RESEND_API_KEY,EMAIL_FROM:process.env.EMAIL_FROM,EMAIL_DELIVERY_ENABLED:process.env.EMAIL_DELIVERY_ENABLED};
 process.env.RESEND_API_KEY='test-only-transport';process.env.EMAIL_FROM='Practice <appointments@example.invalid>';process.env.EMAIL_DELIVERY_ENABLED='true';
 const day=new Date(Date.now()+12*86400000).toISOString().slice(0,10);const minute=String(Math.floor(Math.random()*60)).padStart(2,'0');let slots=[],requestId;const messages=new Map(),keys=[];
 const fakeProvider=async(url,options)=>{const path=new URL(url).pathname;if(options.method==='POST'&&path==='/emails'){const key=options.headers['Idempotency-Key'];assert.ok(key);keys.push(key);const payload=JSON.parse(options.body);const id='test_email_'+messages.size;messages.set(id,{...payload,last_event:payload.scheduled_at?'scheduled':'delivered'});return new Response(JSON.stringify({id}),{status:200});}const id=path.split('/')[2];assert.ok(messages.has(id));if(path.endsWith('/cancel')){messages.get(id).last_event='canceled';return new Response(JSON.stringify({id}),{status:200});}return new Response(JSON.stringify(messages.get(id)),{status:200});};
 try{
  slots=(await publishWindow({localStart:day+'T17:'+minute,localEnd:day+'T18:'+minute,format:'Online'})).map(s=>s.id);
  const request=await requestAppointment({slotId:slots[0],name:'Synthetic email test',email:'delivered@resend.dev',phone:'',service:'individual'});requestId=request.id;
  await reviewRequest({id:requestId,action:'approve',connectionDetails:'Synthetic test meeting details'});
  const limited=await processEmailJobs({requestId,fetchImpl:async()=>new Response(JSON.stringify({error:'rate_limit_exceeded'}),{status:429})});assert.equal(limited.failed,1);assert.equal(limited.processed,0);
  const knownFailure=await query("SELECT uncertain FROM email_jobs WHERE request_id=$1 AND kind='confirmation'",[requestId]);assert.equal(knownFailure[0].uncertain,false);
  await query("UPDATE email_jobs SET locked_at=now()-interval '6 minutes',first_attempt_at=now()-interval '2 days' WHERE request_id=$1 AND kind='confirmation'",[requestId]);
  const first=await processEmailJobs({requestId,fetchImpl:fakeProvider});assert.equal(first.processed,3);assert.equal(messages.size,3);assert.equal(new Set(keys).size,3);
  const reminders=[...messages.values()].filter(m=>m.scheduled_at);assert.equal(reminders.length,2);assert.ok(reminders.some(m=>new Date(request.starts_at)-new Date(m.scheduled_at)===86400000));assert.ok(reminders.some(m=>new Date(request.starts_at)-new Date(m.scheduled_at)===3600000));
  assert.equal((await processEmailJobs({requestId,fetchImpl:fakeProvider})).processed,0);assert.equal(messages.size,3);
  await reviewRequest({id:requestId,action:'cancel'});await processEmailJobs({requestId,fetchImpl:fakeProvider});
  assert.ok(reminders.every(m=>m.last_event==='canceled'));assert.equal(messages.size,4);
  const statuses=await query('SELECT kind,status FROM email_jobs WHERE request_id=$1',[requestId]);assert.equal(statuses.find(s=>s.kind==='cancellation').status,'sent');assert.ok(statuses.filter(s=>s.kind.startsWith('reminder')).every(s=>s.status==='cancelled'));
 }finally{
  if(requestId){await query('DELETE FROM email_jobs WHERE request_id=$1',[requestId]);await query('DELETE FROM appointment_requests WHERE id=$1',[requestId]);}
  if(slots.length){const rows=await query('SELECT window_id FROM appointment_slots WHERE id=ANY($1::uuid[])',[slots]);await query('DELETE FROM appointment_slots WHERE id=ANY($1::uuid[])',[slots]);for(const r of rows)if(r.window_id)await query('DELETE FROM appointment_windows WHERE id=$1',[r.window_id]);}
  for(const [key,value] of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
