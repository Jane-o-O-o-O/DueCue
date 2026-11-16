import {registerHooks} from 'node:module';
import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {readdirSync,createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers') {
    return {url: new URL('./bindings.mjs',import.meta.url).href, shortCircuit:true};
  }
  return nextResolve(specifier,context);
}});
const {env} = await import('./bindings.mjs');
const {default: app} = await import('./dist/server/index.js');
const origin = new URL(process.env.PUBLIC_ORIGIN || 'https://duecue.jane-zz.online').origin;
const username = process.env.DUECUE_USERNAME || 'owner';
const password = process.env.DUECUE_PASSWORD;
if (!password || password.length < 20) throw Error('Set a private DUECUE_PASSWORD with at least 20 characters');
const hash = text => createHash('sha256').update(text).digest();
const expected = hash('Basic '+Buffer.from(username+':'+password).toString('base64'));
const files = new Map();
const staticRoot = fileURLToPath(new URL('./dist/client/',import.meta.url));
function indexFiles(dir='') {
  for (const entry of readdirSync(join(staticRoot,dir),{withFileTypes:true})) {
    if (entry.name.startsWith('.') || entry.name === '_headers') continue;
    const key = dir ? dir+'/'+entry.name : entry.name;
    if(entry.isDirectory()) indexFiles(key);
    else if(entry.isFile()) files.set('/'+key,join(staticRoot,key));
  }
}
indexFiles();
const mime = {'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.png':'image/png',
  '.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ico':'image/x-icon',
  '.json':'application/json','.woff2':'font/woff2','.wasm':'application/wasm','.txt':'text/plain','.gz':'application/gzip'};
function reply(res,status,text,headers={}) {
  res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store',...headers});
  res.end(text);
}
async function handle(req,res) {
  if (!req.url?.startsWith('/') || req.url.startsWith('//')) return reply(res,400,'Bad request');
  const url = new URL(req.url,origin);
  if (url.origin !== origin) return reply(res,400,'Bad request');
  if (req.method === 'GET' && url.pathname === '/healthz') {
    env.DB.prepare('SELECT 1').first(); return reply(res,200,'ok\n');
  }
  const callback = req.method === 'POST' && url.pathname === '/api/alipay/notify';
  if (!callback && !timingSafeEqual(expected,hash(req.headers.authorization || ''))) {
    return reply(res,401,'请登录知期',{'WWW-Authenticate':'Basic realm="DueCue", charset="UTF-8"'});
  }
  const file = files.get(url.pathname);
  if (file && (req.method === 'GET' || req.method === 'HEAD')) {
    const suffix=extname(file), permanent=url.pathname.startsWith('/_next/static/');
    res.writeHead(200,{'Content-Type':mime[suffix] || 'application/octet-stream',
      'Content-Length':(await stat(file)).size,'X-Content-Type-Options':'nosniff',
      'Cache-Control':permanent?'private, max-age=31536000, immutable':'private, max-age=0, must-revalidate'});
    if(req.method === 'HEAD') return res.end();
    await pipeline(createReadStream(file),res); return;
  }
  const headers = new Headers();
  for (const name of ['accept','accept-language','content-type','origin','referer','user-agent','rsc',
    'next-router-state-tree','next-router-prefetch','next-url']) {
    if (typeof req.headers[name]==='string') headers.set(name,req.headers[name]);
  }
  if (!callback) headers.set('oai-authenticated-user-id',username);
  const init = {method:req.method,headers};
  if (!['GET','HEAD'].includes(req.method)) {
    const chunks=[]; let size=0;
    const limit= url.pathname==='/api/recognize' ? 9500000 : 128000;
    if(Number(req.headers['content-length'])>limit) return reply(res,413,'Request too large');
    for await (const chunk of req) {
      size+=chunk.length;
      if(size>limit) return reply(res,413,'Request too large');
      chunks.push(chunk);
    }
    init.body=Buffer.concat(chunks);
  }
  const result=await app.fetch(new Request(url,init),env,{props:{},waitUntil(promise){
    Promise.resolve(promise).catch(()=>console.error('DueCue background job failed'));
  },passThroughOnException(){}});
  const outgoing=Object.fromEntries(result.headers);
  outgoing['cache-control']='private, no-store';
  res.writeHead(result.status,outgoing);
  if(result.body && req.method!=='HEAD') await pipeline(Readable.fromWeb(result.body),res); else res.end();
}

const server=createServer((req,res)=>{handle(req,res).catch(error=>{
  console.error('DueCue request failed:',error.name, String(error.message).slice(0,160));
  if(!res.headersSent) reply(res,500,'Unexpected server error'); else res.destroy();
});});
server.requestTimeout=120000;
server.listen(Number(process.env.PORT || 3000),process.env.BIND_ADDRESS || '127.0.0.1',()=>{
  console.log('DueCue started for '+origin);
});
