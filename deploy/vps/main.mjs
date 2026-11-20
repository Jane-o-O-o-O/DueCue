import {registerHooks} from 'node:module';
import {createServer} from 'node:http';
import {identity,accountRoute,allow} from './accounts.mjs';
import {redeemCode} from './redemption.mjs';
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
const origin = new URL(process.env.PUBLIC_ORIGIN || 'https://duecue.jane-zz.online').origin;
const localSandbox = process.env.DUECUE_SANDBOX_PREVIEW === '1' && env.ALIPAY_MODE === 'sandbox' &&
  process.env.BIND_ADDRESS === '127.0.0.1' && new URL(origin).hostname === '127.0.0.1';
const buildDir = new URL(localSandbox ? '../../dist/' : './dist/', import.meta.url);
const {default: app, reconcilePendingPayments} = await import(new URL('server/index.js',buildDir).href);
const cardRequests = localSandbox ? null : await import('./card-requests.mjs');
const files = new Map();
const staticRoot = fileURLToPath(new URL('client/',buildDir));
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
const installAssets = new Set(['/manifest.webmanifest','/manifest-en.webmanifest','/apple-touch-icon.png',
  '/favicon.ico','/icon-192.png','/icon-512.png']);
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
  if (url.pathname === '/login' || url.pathname === '/account' || url.pathname.startsWith('/auth/')) {
    return localSandbox ? reply(res,404,'Not found') : accountRoute(req,res,url);
  }
  const paymentServerRequest = req.method === 'POST' && ['/api/alipay/notify','/api/alipay/manage'].includes(url.pathname);
  const paymentResult = req.method === 'GET' && url.pathname === '/payment/result';
  const user = paymentServerRequest ? null : localSandbox ? 'local-sandbox' : identity(req);
  const publicInstallAsset = installAssets.has(url.pathname) && ['GET','HEAD'].includes(req.method) && files.has(url.pathname);
  if (!paymentServerRequest && !paymentResult && !user && !publicInstallAsset) {
    if (req.method === 'GET' && ['/','/cards','/brands'].includes(url.pathname)) {
      res.writeHead(303,{Location:'/login?next='+encodeURIComponent(url.pathname + url.search),'Cache-Control':'no-store'});
      return res.end();
    }
    return reply(res,401,'请登录知期');
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
  for (const name of ['accept','accept-language','content-type','origin','referer','sec-fetch-site','user-agent','authorization','rsc',
    'next-router-state-tree','next-router-prefetch','next-url']) {
    if (typeof req.headers[name]==='string') headers.set(name,req.headers[name]);
  }
  if (user) headers.set('oai-authenticated-user-id',user);
  const init = {method:req.method,headers};
  if (!['GET','HEAD'].includes(req.method)) {
    const chunks=[]; let size=0;
    const limit= ['/api/card-requests','/api/redeem'].includes(url.pathname) ? 4096 : url.pathname==='/api/recognize' ? 9500000 : 128000;
    if(Number(req.headers['content-length'])>limit) return reply(res,413,'Request too large');
    for await (const chunk of req) {
      size+=chunk.length;
      if(size>limit) return reply(res,413,'Request too large');
      chunks.push(chunk);
    }
    init.body=Buffer.concat(chunks);
  }
  const request = new Request(url,init);
  if (url.pathname==='/api/redeem') {
    let status=200, body;
    const source=request.headers.get('origin');
    const sameOrigin=source && source!=='null' ? source===origin : request.headers.get('sec-fetch-site')==='same-origin';
    if (request.method!=='POST') { status=405; body={error:'请从设置页兑换。'}; }
    else if (!sameOrigin || request.headers.get('content-type')?.split(';')[0]!=='application/json') {
      status=403; body={error:'请从知期设置页兑换。'};
    } else if (!allow('redeem:'+user,20,60000)) {
      status=429; body={error:'尝试次数较多，请稍后再试。'};
    } else {
      const input=await request.json().catch(()=>null);
      body=redeemCode(user,input?.code);
      if (body.error) status=400;
    }
    return reply(res,status,JSON.stringify(body),{'Content-Type':'application/json; charset=utf-8'});
  }
  const result=url.pathname==='/api/card-requests' && cardRequests ? await cardRequests.handleCardRequests(request,user) : await app.fetch(request,env,{props:{},waitUntil(promise){
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

if (env.ALIPAY_MODE) {
  const reconcile = () => reconcilePendingPayments().catch(() => console.warn('Alipay reconciliation deferred'));
  void reconcile();
  setInterval(reconcile, 15_000).unref();
}
