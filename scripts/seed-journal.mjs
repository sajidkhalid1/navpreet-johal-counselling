import {readFile} from 'node:fs/promises';
import {query} from '../lib/db.js';
const stories=JSON.parse(await readFile('public/starter-stories.json','utf8'));
for(const s of stories)await query(`INSERT INTO stories(title,category,body,image,published,is_sample,sample_key,source_links) VALUES($1,$2,$3,$4,true,true,$5,$6::jsonb) ON CONFLICT(sample_key) DO NOTHING`,[s.title,s.category,s.body,s.image,s.key,JSON.stringify(s.sources)]);
console.log('Original sample journal reflections are available. Existing edits were preserved.');
