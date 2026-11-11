import {query} from './db.js';
export const emailReady=()=>Boolean(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM&&process.env.EMAIL_DELIVERY_ENABLED==='true');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Edmonton',weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const time=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Edmonton',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const stamp=date=>new Date(date).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const calendarEscape=value=>String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function emailPayload(job,now=Date.now()){
 const cancelled=job.kind==='cancellation',confirmation=job.kind==='confirmation';
 const subject=cancelled?'Your appointment has been cancelled':confirmation?'Your appointment is confirmed':'A reminder about your upcoming appointment';
 const intro=cancelled?'Your appointment has been cancelled.':confirmation?'Your appointment with Navpreet Johal has been approved and confirmed.':'A gentle reminder about your confirmed appointment with Navpreet Johal.';
 const details=`${when.format(new Date(job.starts_at))} – ${time.format(new Date(job.ends_at))}\n${job.format} · 1 hour`;
 const connection=cancelled?'':job.connection_details||'Connection details will be arranged directly.';
 const text=`Hello ${job.name},\n\n${intro}\n\n${details}\n\n${connection}\n\nFor questions or changes, call (587) 417-5036. Please avoid sending clinical details by email.\n\nReference: ${job.request_id}\nNavpreet Johal Counselling`;
 const html=`<!doctype html><html><body style="margin:0;background:#f7f6f0;font-family:Arial,sans-serif;color:#40523b"><div style="max-width:560px;margin:32px auto;padding:35px;background:#fffef9;border:1px solid #dfe5d4;border-radius:15px"><p style="font-size:12px;letter-spacing:2px;color:#8b9a7c">NAVPREET JOHAL COUNSELLING</p><h1 style="font:normal 30px Georgia,serif">${escape(subject)}</h1><p>Hello ${escape(job.name)},</p><p style="line-height:1.8">${escape(intro)}</p><div style="padding:20px;background:#eef3e6;border-radius:10px;line-height:1.9">${escape(details).replace(/\n/g,'<br>')}</div>${connection?`<p style="line-height:1.8">${escape(connection).replace(/\n/g,'<br>')}</p>`:''}<p style="font-size:12px;line-height:1.9;color:#819170">For questions or changes, call (587) 417-5036. Please avoid sending clinical details by email.</p><p style="font-size:10px;color:#9ba68d">Reference: ${escape(job.request_id)}</p></div></body></html>`;
 const payload={from:process.env.EMAIL_FROM,to:[job.email],subject,text,html};
 if(process.env.EMAIL_REPLY_TO)payload.reply_to=process.env.EMAIL_REPLY_TO;
 if(new Date(job.send_at).getTime()>now+60000)payload.scheduled_at=new Date(job.send_at).toISOString();
 if(confirmation){const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Navpreet Johal//Appointments//EN','BEGIN:VEVENT','UID:'+job.request_id+'@navpreet-johal','DTSTAMP:'+stamp(now),'DTSTART:'+stamp(job.starts_at),'DTEND:'+stamp(job.ends_at),'SUMMARY:Appointment with Navpreet Johal','DESCRIPTION:'+calendarEscape(connection+'\nFor changes call (587) 417-5036.'),'END:VEVENT','END:VCALENDAR'].join('\r\n');payload.attachments=[{filename:'appointment.ics',content:Buffer.from(ics).toString('base64'),content_type:'text/calendar'}];}
 return payload;
}
async function provider(path,{method='GET',body,key,fetchImpl=fetch}={}){
 const headers={Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'};if(key)headers['Idempotency-Key']=key;
 let response;try{response=await fetchImpl('https://api.resend.com'+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});}catch{throw Object.assign(new Error('Email provider response was interrupted. Delivery will be checked before retrying.'),{uncertain:true});}
 let data;try{data=await response.json();}catch{throw Object.assign(new Error('Email provider returned an unreadable response.'),{uncertain:response.ok||response.status>=500});}
 if(!response.ok)throw Object.assign(new Error(`Email provider returned HTTP ${response.status}. Check sender verification, account limits, and API permissions.`),{uncertain:response.status>=500,status:response.status});
 return data;
}
async function reconcile({requestId,fetchImpl}){
 const jobs=await query(`SELECT j.id,j.provider_id,r.status AS request_status FROM email_jobs j JOIN appointment_requests r ON r.id=j.request_id WHERE j.status='scheduled' AND ($1::uuid IS NULL OR j.request_id=$1) AND (j.send_at<now() OR r.status<>'approved') LIMIT 30`,[requestId]);
 for(const job of jobs){try{const data=await provider('/emails/'+job.provider_id,{fetchImpl});const event=data.last_event;if(job.request_status!=='approved'&&['scheduled','queued'].includes(event)){await provider('/emails/'+job.provider_id+'/cancel',{method:'POST',fetchImpl});await query("UPDATE email_jobs SET status='cancelled',last_error=NULL WHERE id=$1",[job.id]);}
 else if(['sent','delivered','opened','clicked'].includes(event))await query("UPDATE email_jobs SET status='sent',last_error=NULL WHERE id=$1",[job.id]);
 else if(['canceled','cancelled'].includes(event))await query("UPDATE email_jobs SET status='cancelled',last_error=NULL WHERE id=$1",[job.id]);
 else if(['bounced','failed','suppressed'].includes(event))await query("UPDATE email_jobs SET status='failed',attempts=5,last_error='The email provider reported a delivery failure. Contact the client directly.' WHERE id=$1",[job.id]);
 }catch(error){await query('UPDATE email_jobs SET last_error=$2 WHERE id=$1',[job.id,error.message]);}}
}
export async function processEmailJobs({requestId=null,limit=20,fetchImpl=fetch}={}){
 if(!emailReady())return {connected:false,processed:0,failed:0};
 await reconcile({requestId,fetchImpl});
 await query(`UPDATE email_jobs SET status='unknown',last_error='Delivery is uncertain after the provider idempotency window. Review in Resend before resending.' WHERE status IN('failed','processing') AND uncertain AND first_attempt_at<now()-interval '23 hours' AND ($1::uuid IS NULL OR request_id=$1)`,[requestId]);
 await query(`UPDATE email_jobs SET status='failed',last_error='Interrupted send recovered for an idempotent retry.' WHERE status='processing' AND locked_at<now()-interval '10 minutes' AND ($1::uuid IS NULL OR request_id=$1)`,[requestId]);
 await query(`UPDATE email_jobs j SET status='cancelled' FROM appointment_requests r,appointment_slots s WHERE j.request_id=r.id AND r.slot_id=s.id AND j.status IN('queued','failed') AND j.kind<>'cancellation' AND (r.status<>'approved' OR s.starts_at<=now() OR (j.kind='reminder_day' AND s.starts_at<now()+interval '2 hours')) AND ($1::uuid IS NULL OR j.request_id=$1)`,[requestId]);
 let processed=0,failed=0;
 for(let i=0;i<Math.min(limit,25);i++){
  const rows=await query(`WITH candidate AS (SELECT j.id,j.uncertain AS was_uncertain FROM email_jobs j JOIN appointment_requests r ON r.id=j.request_id WHERE j.status IN('queued','failed') AND j.provider_id IS NULL AND j.attempts<5 AND j.send_at<now()+interval '29 days' AND (j.status='queued' OR j.locked_at<now()-interval '5 minutes') AND (r.status='approved' OR (r.status='cancelled' AND j.kind='cancellation')) AND ($1::uuid IS NULL OR j.request_id=$1) ORDER BY j.send_at FOR UPDATE OF j SKIP LOCKED LIMIT 1), claimed AS (UPDATE email_jobs AS job SET status='processing',locked_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),uncertain=true,attempts=attempts+1 FROM candidate WHERE job.id=candidate.id RETURNING job.*,candidate.was_uncertain) SELECT c.*,r.name,r.email,r.connection_details,r.status AS request_status,s.starts_at,s.ends_at,s.format FROM claimed c JOIN appointment_requests r ON r.id=c.request_id JOIN appointment_slots s ON s.id=r.slot_id`,[requestId]);
  if(!rows.length)break;const job=rows[0];
  try{
   const current=await query('SELECT status FROM appointment_requests WHERE id=$1',[job.request_id]);
   if(current[0].status!=='approved'&&job.kind!=='cancellation'){await query("UPDATE email_jobs SET status='cancelled' WHERE id=$1",[job.id]);continue;}
   const payload=job.payload||emailPayload(job);if(!job.payload)await query('UPDATE email_jobs SET payload=$2::jsonb WHERE id=$1',[job.id,JSON.stringify(payload)]);
   const sent=await provider('/emails',{method:'POST',body:payload,key:'nj-'+job.kind+'/'+job.id,fetchImpl});
   if(!sent.id)throw Object.assign(new Error('Email accepted without an identifier. Review delivery before resending.'),{uncertain:true});
   await query('UPDATE email_jobs SET status=$2,provider_id=$3,last_error=NULL,uncertain=false WHERE id=$1',[job.id,payload.scheduled_at?'scheduled':'sent',sent.id]);processed++;
  }catch(error){await query("UPDATE email_jobs SET status='failed',last_error=$2,uncertain=$3 WHERE id=$1",[job.id,error.message,error.uncertain!==false||job.was_uncertain===true]);failed++;if(error.status===429)break;}
 }
 // Also catches cancellation that happened while a provider request was in flight.
 await reconcile({requestId,fetchImpl});return {connected:true,processed,failed};
}
