import {query} from './db.js';
export const services=['consultation','individual','couples','family'];
const invalid=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function validWindow(start,end){
 const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'Z'))&&new Date(value+'Z').toISOString().slice(0,16)===value;
 if(!valid(start)||!valid(end)||start.slice(0,10)!==end.slice(0,10))return false;
 const hours=(Date.parse(end+'Z')-Date.parse(start+'Z'))/3600000;
 return hours>=1&&hours<=12&&Number.isInteger(hours);
}
export async function availableSlots(){return query("SELECT id,starts_at,ends_at,format,to_char(starts_at AT TIME ZONE 'America/Edmonton','YYYY-MM-DD') AS local_date FROM appointment_slots WHERE active AND NOT reserved AND starts_at>now()+interval '2 hours' AND starts_at<now()+interval '1 year' ORDER BY starts_at LIMIT 1000");}
export async function publishWindow(body){
 if(!validWindow(body.localStart,body.localEnd)||!['Phone','Online','In person'].includes(body.format))invalid('Choose one date and an availability range of 1–12 whole hours.');
 const result=await query(`WITH created_window AS (
 INSERT INTO appointment_windows(starts_at,ends_at,format)
 SELECT $1::timestamp AT TIME ZONE 'America/Edmonton',$2::timestamp AT TIME ZONE 'America/Edmonton',$3
 WHERE $1::timestamp AT TIME ZONE 'America/Edmonton'>now()+interval '2 hours'
 RETURNING *), added AS (
 INSERT INTO appointment_slots(window_id,starts_at,ends_at,format)
 SELECT created_window.id,t,t+interval '1 hour',created_window.format FROM created_window CROSS JOIN LATERAL generate_series(created_window.starts_at,created_window.ends_at-interval '1 hour',interval '1 hour') t RETURNING id)
 SELECT id FROM added`,[body.localStart,body.localEnd,body.format]);
 if(!result.length)invalid('Availability must begin at least two hours in the future.');return result;
}
export async function requestAppointment(body){
 if(!services.includes(body.service))invalid('Choose the type of appointment you need.');
 const rows=await query(`WITH reserved AS (
 UPDATE appointment_slots SET reserved=true WHERE id=$1 AND active AND NOT reserved AND starts_at>now()+interval '2 hours' RETURNING *),
 requested AS (INSERT INTO appointment_requests(slot_id,name,email,phone,service) SELECT id,$2,$3,$4,$5 FROM reserved RETURNING id,status)
 SELECT requested.id,requested.status,reserved.starts_at,reserved.ends_at,reserved.format,$5::text AS service FROM requested CROSS JOIN reserved`,[body.slotId,body.name.trim(),body.email.toLowerCase().trim(),body.phone||'',body.service]);
 if(!rows.length)invalid('That time is no longer available. Please select another appointment.',409);return rows[0];
}
export async function ownerSlots(){return query('SELECT id,window_id,starts_at,ends_at,format,active,reserved AS booked FROM appointment_slots WHERE ends_at>now() ORDER BY starts_at LIMIT 1000');}
export async function ownerBookings(){return query(`SELECT r.id,r.name,r.email,r.phone,r.service,r.status,r.connection_details,r.created_at,s.starts_at,s.ends_at,s.format,
 (SELECT json_agg(json_build_object('kind',j.kind,'status',j.status,'error',j.last_error)) FROM email_jobs j WHERE j.request_id=r.id) AS email_status
 FROM appointment_requests r JOIN appointment_slots s ON s.id=r.slot_id ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END,s.starts_at LIMIT 500`);}
export async function reviewRequest(body){
 if(body.action==='approve'){
  const detail=body.connectionDetails||'Connection details will be arranged directly. Please call (587) 417-5036 with any questions.';
  if(typeof detail!=='string'||detail.length>2000)invalid('Connection details must be under 2,000 characters.');
  const rows=await query(`WITH approved AS (
   UPDATE appointment_requests r SET status='approved',reviewed_at=now(),connection_details=$2 FROM appointment_slots s
   WHERE r.id=$1 AND r.slot_id=s.id AND r.status='pending' AND s.starts_at>now() RETURNING r.id,s.starts_at),
   jobs AS (INSERT INTO email_jobs(request_id,kind,send_at)
   SELECT approved.id,t.kind,t.send_at FROM approved CROSS JOIN LATERAL (VALUES ('confirmation',now()),('reminder_day',approved.starts_at-interval '24 hours'),('reminder_hour',approved.starts_at-interval '1 hour')) t(kind,send_at)
   WHERE t.kind='confirmation' OR t.send_at>now() ON CONFLICT(request_id,kind) DO NOTHING RETURNING id)
   SELECT approved.id FROM approved`,[body.id,detail]);
  if(!rows.length)invalid('This request has already been reviewed or its appointment time has passed.',409);return rows;
 }
 if(!['decline','cancel'].includes(body.action))invalid('Invalid booking action.');
 const target=body.action==='decline'?'declined':'cancelled';
 const rows=await query(`WITH previous AS (SELECT id,status FROM appointment_requests WHERE id=$1 AND status=ANY($3::text[]) FOR UPDATE), changed AS (
  UPDATE appointment_requests r SET status=$2,reviewed_at=now() FROM previous WHERE r.id=previous.id RETURNING r.id,r.slot_id,previous.status AS previous_status),
  released AS (UPDATE appointment_slots SET reserved=false,active=$4 WHERE id IN (SELECT slot_id FROM changed) RETURNING id),
  stopped AS (UPDATE email_jobs SET status='cancelled' WHERE request_id IN(SELECT id FROM changed) AND status IN('queued','failed') AND kind<>'cancellation' RETURNING id),
  notice AS (INSERT INTO email_jobs(request_id,kind,send_at) SELECT id,'cancellation',now() FROM changed WHERE previous_status='approved' ON CONFLICT(request_id,kind) DO NOTHING RETURNING id)
  SELECT id FROM changed`,[body.id,target,body.action==='decline'?['pending']:['approved','pending'],body.reopen===true]);
 if(!rows.length)invalid('This request has already changed. Refresh the dashboard.',409);return rows;
}
