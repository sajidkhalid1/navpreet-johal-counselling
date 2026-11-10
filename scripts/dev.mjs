import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import handler from '../api/index.js';
try{process.loadEnvFile('.env.local');}catch{}
const root=resolve('public');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api')) {let body='';for await(const chunk of req){body+=chunk;if(body.length>2200000){res.writeHead(413);res.end();return;}}try{req.body=body?JSON.parse(body):{};}catch{res.writeHead(400);res.end();return;}await handler(req,res);return;}
  const file=resolve(root,'.'+(path==='/'?'/index.html':path==='/owner'?'/admin.html':path));
  if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(3000,'127.0.0.1',()=>console.log('Local: http://localhost:3000'));
