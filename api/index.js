import {query} from '../lib/db.js';
import {hash,token,passwordMatches,validImage,validEmail,cookie} from '../lib/security.js';
const uuid = value => typeof value==='string' && /^[a-f0-9-]{36}$/.test(value);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(value,max,min=1)=> typeof value==='string'&&value.trim().length>=min&&value.length<=max;
export async function rateLimit(req,scope,max=10) {
  const ip=req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown';
  const key=hash(`${scope}:${ip}`);
  const rows=await query(`INSERT INTO rate_limits(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.window_at<now()-interval '15 minutes' THEN 1 ELSE rate_limits.hits+1 END,window_at=CASE WHEN rate_limits.window_at<now()-interval '15 minutes' THEN now() ELSE rate_limits.window_at END RETURNING hits`,[key]);
  if(Number(rows[0].hits)>max) fail('Too many attempts. Please try again in 15 minutes.',429);
}
async function owner(req) {const session=cookie(req);if(!session)fail('Please sign in.',401);const rows=await query('SELECT token_hash FROM sessions WHERE token_hash=$1 AND expires_at>now()',[hash(session)]);if(!rows.length)fail('Your session has ended. Please sign in again.',401);}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const path = new URL(req.url,'http://localhost').pathname.replace(/^\/api\/?/,'').replace(/\/$/,'');
  const method=req.method;
  try {
    if(!['GET','POST'].includes(method))fail('Method not allowed',405);
    if(method==='POST') {
      const origin=req.headers.origin;
      const allowed=process.env.APP_ORIGIN||`${process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:'http://localhost:3000'}`;
      if(!origin||origin!==new URL(allowed).origin)fail('Request origin is not allowed.',403);
      if(!String(req.headers['content-type']||'').startsWith('application/json'))fail('JSON required.',415);
    }
    const b=req.body||{};let result;
    if(path==='slots'&&method==='GET') result=await query("SELECT id,starts_at,ends_at,format FROM slots WHERE active AND NOT booked AND starts_at>now()+interval '2 hours' ORDER BY starts_at LIMIT 120");
    else if(path==='stories'&&method==='GET') result=await query('SELECT id,title,category,body,image,created_at FROM stories WHERE published ORDER BY created_at DESC LIMIT 60');
    else if(path==='book'&&method==='POST') {
      await rateLimit(req,'booking',8);
      if(!uuid(b.slotId)||!text(b.name,100)||!validEmail(b.email)||!text(b.phone??'',30,0)||b.consent!==true||b.website)fail('Please provide your name, a valid email, and scheduling consent.');
      result=await query(`WITH reserved AS (UPDATE slots SET booked=true WHERE id=$1 AND active AND NOT booked AND starts_at>now()+interval '2 hours' RETURNING id,starts_at,ends_at,format), created AS (INSERT INTO bookings(slot_id,name,email,phone) SELECT id,$2,$3,$4 FROM reserved RETURNING id) SELECT created.id,reserved.starts_at,reserved.ends_at,reserved.format FROM created CROSS JOIN reserved`,[b.slotId,b.name.trim(),b.email.toLowerCase().trim(),b.phone||'']);
      if(!result.length)fail('That appointment has just become unavailable. Please choose another time.',409);
      result=result[0];
    } else if(path==='login'&&method==='POST') {
      await rateLimit(req,'login',8);
      if(!text(b.password,200)||typeof b.email!=='string'||b.email.toLowerCase()!==process.env.ADMIN_EMAIL?.toLowerCase()||!passwordMatches(b.password,process.env.ADMIN_PASSWORD_HASH||''))fail('Email or password is incorrect.',401);
      const value=token();await query("INSERT INTO sessions(token_hash,expires_at) VALUES($1,now()+interval '8 hours')",[hash(value)]);
      res.setHeader('Set-Cookie',`nj_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`);result={ok:true};
    } else {
      await owner(req);
      if(path==='me'&&method==='GET')result={email:process.env.ADMIN_EMAIL};
      else if(path==='logout'&&method==='POST') {await query('DELETE FROM sessions WHERE token_hash=$1',[hash(cookie(req))]);res.setHeader('Set-Cookie','nj_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');result={ok:true};}
      else if(path==='admin/slots'&&method==='GET') result=await query('SELECT id,starts_at,ends_at,format,active,booked FROM slots WHERE ends_at>now() ORDER BY starts_at LIMIT 300');
      else if(path==='admin/slots'&&method==='POST') {
        if(b.action==='remove') {if(!uuid(b.id))fail('Invalid slot.');result=await query('UPDATE slots SET active=false WHERE id=$1 AND NOT booked RETURNING id',[b.id]);if(!result.length)fail('Booked appointments must be cancelled in Bookings.',409);}
        else {
          if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.localStart||'')||!['Phone','Online','In person'].includes(b.format)||!Number.isInteger(b.duration)||b.duration!==15)fail('Choose a date, time, and format. Consultations are 15 minutes.');
          result=await query(`INSERT INTO slots(starts_at,ends_at,format) SELECT $1::timestamp AT TIME ZONE 'America/Edmonton',($1::timestamp AT TIME ZONE 'America/Edmonton')+interval '15 minutes',$2 WHERE ($1::timestamp AT TIME ZONE 'America/Edmonton')>now()+interval '2 hours' RETURNING id`,[b.localStart,b.format]);
          if(!result.length)fail('Availability must be at least two hours in the future.');
        }
      } else if(path==='admin/bookings'&&method==='GET')result=await query('SELECT b.id,b.name,b.email,b.phone,b.status,s.starts_at,s.ends_at,s.format FROM bookings b JOIN slots s ON s.id=b.slot_id ORDER BY s.starts_at DESC LIMIT 500');
      else if(path==='admin/bookings'&&method==='POST') {
        if(!uuid(b.id)||b.action!=='cancel')fail('Invalid booking action.');
        result=await query(`WITH cancelled AS (UPDATE bookings SET status='cancelled' WHERE id=$1 AND status='confirmed' RETURNING slot_id) UPDATE slots SET active=false WHERE id IN (SELECT slot_id FROM cancelled) RETURNING id`,[b.id]);
      } else if(path==='admin/stories'&&method==='GET')result=await query('SELECT id,title,category,body,image,published,created_at FROM stories ORDER BY created_at DESC LIMIT 100');
      else if(path==='admin/stories'&&method==='POST') {
        if(!text(b.title,160)||!text(b.category,60)||!text(b.body,50000)||!validImage(b.image||'')||typeof b.published!=='boolean')fail('Add a title and story. Images must be JPEG, PNG, or WebP under 1.4 MB.');
        const params=[b.title.trim(),b.category.trim(),b.body,b.image||'',b.published];
        if(b.id) {if(!uuid(b.id))fail('Invalid story.');result=await query('UPDATE stories SET title=$1,category=$2,body=$3,image=$4,published=$5,updated_at=now() WHERE id=$6 RETURNING id',[...params,b.id]);}
        else result=await query('INSERT INTO stories(title,category,body,image,published) VALUES($1,$2,$3,$4,$5) RETURNING id',params);
      } else fail('Not found',404);
    }
    res.statusCode=200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  } catch(error) {
    res.statusCode=error.status||(error.code==='23P01'?409:500);res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({error:error.status?error.message:error.code==='23P01'?'This availability overlaps an existing appointment.':'Something went wrong. Please try again or call (587) 417-5036.'}));
  }
}
