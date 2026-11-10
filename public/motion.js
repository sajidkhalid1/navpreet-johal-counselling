const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let paused=localStorage.getItem('nj-motion')==='paused'||reducedMotion.matches;
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#site-navigation');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');nav.classList.toggle('menu-open',open);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu');nav.classList.remove('menu-open');}});
const toggle=document.querySelector('.motion-toggle');
function motionState(){document.body.classList.toggle('motion-paused',paused);if(toggle){toggle.textContent=paused?'Resume motion':'Pause motion';toggle.setAttribute('aria-pressed',String(paused));}}
toggle?.addEventListener('click',()=>{paused=!paused;localStorage.setItem('nj-motion',paused?'paused':'playing');motionState();schedule();});
reducedMotion.addEventListener('change',e=>{paused=e.matches||localStorage.getItem('nj-motion')==='paused';motionState();schedule();});motionState();
const scaled=[...document.querySelectorAll('[data-scroll-scale]')],parallax=[...document.querySelectorAll('[data-parallax]')];
const inView=new Set();const visibility=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)inView.add(entry.target);else inView.delete(entry.target);}schedule();},{rootMargin:'120px'});[...scaled,...parallax].forEach(el=>visibility.observe(el));
new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(node.nodeType!==1)continue;if(node.matches('[data-scroll-scale],[data-parallax]'))visibility.observe(node);node.querySelectorAll('[data-scroll-scale],[data-parallax]').forEach(el=>visibility.observe(el));}}).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(update);}
function update(){scheduled=false;if(paused)return;const height=innerHeight;for(const el of inView){const box=el.getBoundingClientRect();const center=box.top+box.height/2;const distance=Math.min(1,Math.abs(center-height*.5)/(height*.5+box.height*.5));if(el.hasAttribute('data-scroll-scale')){el.style.setProperty('--scroll-scale',String(1-distance*.065));el.style.setProperty('--scroll-y',`${(center-height*.5)*.022}px`);}if(el.hasAttribute('data-parallax'))el.style.setProperty('--parallax-y',`${(height*.5-center)*Number(el.dataset.parallax)}px`);}}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});schedule();
// A low-density botanical field: drifting seed shapes and warm points of light.
const canvas=document.querySelector('#garden-canvas');
if(canvas){const ctx=canvas.getContext('2d');let width=0,height=0,frame=0,heroVisible=true,last=0;const particles=Array.from({length:20},(_,i)=>({x:(i*.137)%1,y:(i*.263)%1,r:2+(i%4),speed:.000008+(i%5)*.000003,phase:i*1.7}));
function size(){const box=canvas.getBoundingClientRect();width=box.width;height=box.height;const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=width*ratio;canvas.height=height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);}size();addEventListener('resize',size,{passive:true});
new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;if(heroVisible)run();}).observe(canvas);
function draw(time){frame=0;if(paused||document.hidden||!heroVisible)return;if(time-last>32){ctx.clearRect(0,0,width,height);for(const p of particles){const x=(p.x+Math.sin(time*.00011+p.phase)*.025)*width;const y=((p.y-time*p.speed)%1+1)%1*height;ctx.save();ctx.translate(x,y);ctx.rotate(time*.00008+p.phase);ctx.fillStyle=p.r>3?'rgba(121,143,97,.17)':'rgba(195,172,124,.35)';ctx.beginPath();ctx.ellipse(0,0,p.r*1.6,p.r*.55,0,0,Math.PI*2);ctx.fill();ctx.restore();}last=time;}frame=requestAnimationFrame(draw);}
function run(){if(!frame&&!paused&&!document.hidden&&heroVisible)frame=requestAnimationFrame(draw);}toggle?.addEventListener('click',run);reducedMotion.addEventListener('change',run);document.addEventListener('visibilitychange',run);run();}
// Preserve older bookmarked section URLs after splitting the site into pages.
const legacy={about:'/about',services:'/services',booking:'/booking',stories:'/journal',contact:'/contact'};
if(location.pathname==='/'&&legacy[location.hash.slice(1)])location.replace(legacy[location.hash.slice(1)]);
