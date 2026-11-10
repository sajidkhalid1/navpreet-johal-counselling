import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
const pages=['index','about','services','booking','journal','story','contact','privacy'];
test('every public page has a unique title, main landmark, navigation, and valid local resources',async()=>{
 const titles=new Set();
 for(const page of pages){const html=await readFile(`public/${page}.html`,'utf8');const title=html.match(/<title>(.*?)<\/title>/)[1];assert.ok(!titles.has(title));titles.add(title);assert.equal((html.match(/<h1[ >]/g)||[]).length,page==='story'||page==='privacy'?0:1);assert.ok(html.includes('<main id="main">'));assert.ok(html.includes('id="site-navigation"'));for(const match of html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)){const path=match[1];if(path==='/')continue;const target=path==='/owner'?'admin.html':pages.includes(path.slice(1))?path.slice(1)+'.html':path.slice(1);await access(resolve('public',target));}}
});
test('separate booking and journal pages retain their data mounts',async()=>{assert.ok((await readFile('public/booking.html','utf8')).includes('id="booking-content"'));assert.ok((await readFile('public/journal.html','utf8')).includes('id="stories-list"'));assert.ok((await readFile('public/story.html','utf8')).includes('id="story-page"'));const home=await readFile('public/index.html','utf8');assert.ok(!home.includes('id="booking-content"'));assert.ok(!home.includes('id="stories-list"'));});
