import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export function passwordHash(password, salt=randomBytes(16).toString('hex')) {return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function passwordMatches(password, encoded) {try {const [salt,key]=encoded.split(':');const actual=scryptSync(password,salt,64);const expected=Buffer.from(key,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}catch{return false;}}
export function validImage(image) {return image==='' || (typeof image==='string' && image.length<=1900000 && (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)||/^\/assets\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(image)));}
export function validEmail(email) {return typeof email==='string'&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}
export function cookie(req) {return /(?:^|;\s*)nj_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];}
