import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('public/assets/fonts',{recursive:true});
const css=await (await fetch('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap',{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'}})).text();
let output=css;let count=0;
for(const url of [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g)||[])]){const extension=url.includes('.woff2')?'woff2':url.includes('.woff')?'woff':'ttf';const name=`font-${count++}.${extension}`;const response=await fetch(url);if(!response.ok)throw Error('Font download failed');await writeFile('public/assets/fonts/'+name,Buffer.from(await response.arrayBuffer()));output=output.split(url).join('/assets/fonts/'+name);}
if(!count)throw Error('No fonts returned');await writeFile('public/fonts.css',output);console.log(`Saved ${count} self-hosted font files.`);
for(const family of ['manrope','dmserifdisplay']){const response=await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`);if(!response.ok)throw Error('Font license download failed');await writeFile(`public/assets/fonts/${family}-OFL.txt`,await response.text());}
