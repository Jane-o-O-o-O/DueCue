import {createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual} from 'node:crypto';
import {sqlite} from './bindings.mjs';

const owner = process.env.DUECUE_USERNAME || 'owner';
const ownerPassword = process.env.DUECUE_PASSWORD;
const secret = process.env.DUECUE_AUTH_SECRET;
const mailKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM;
if (!ownerPassword || !secret || secret.length < 32 || !mailKey || !from) {
  throw Error('Missing DueCue authentication or mail settings');
}
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS auth_accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS auth_sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires);
  CREATE TABLE IF NOT EXISTS auth_codes (id TEXT PRIMARY KEY, email TEXT NOT NULL, digest TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX IF NOT EXISTS auth_codes_expiry ON auth_codes(expires);
  CREATE TABLE IF NOT EXISTS auth_limits (bucket TEXT PRIMARY KEY, used INTEGER NOT NULL, expires INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS auth_limits_expiry ON auth_limits(expires);
`);

const minute = 60000;
const sessionSeconds = 30 * 86400;
const digest = value => createHash('sha256').update(value).digest();
const key = value => digest(value).toString('hex');
const same = (a,b) => timingSafeEqual(digest(a),digest(b));
const codeDigest = (id,code) => createHmac('sha256',secret).update(id + ':' + code).digest('hex');
const legacyAuth = 'Basic ' + Buffer.from(owner + ':' + ownerPassword).toString('base64');
const cookieName = '__Host-duecue';
const cookie = (value,age) => cookieName+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;
const sessionHash = req => {
  const token = /(?:^|;\s*)__Host-duecue=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '');
  return token ? key(token[1]) : '';
};
const client = req => req.headers['x-real-ip'] || req.socket.remoteAddress;
export function allow(bucket, max, ttl) {
  const row = sqlite.prepare(`INSERT INTO auth_limits VALUES (?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET used=CASE WHEN expires<=? THEN 1 ELSE used+1 END,
    expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING used`)
    .get(key(bucket),Date.now()+ttl,Date.now(),Date.now());
  return row.used <= max;
}
function sweep() {
  for (const table of ['auth_sessions','auth_codes','auth_limits']) {
    sqlite.prepare('DELETE FROM '+table+' WHERE expires<=?').run(Date.now());
  }
}
sweep();
setInterval(sweep,10*minute).unref();

export function identity(req) {
  const hash = sessionHash(req);
  if (hash) {
    const session = sqlite.prepare('SELECT user_id FROM auth_sessions WHERE hash=? AND expires>?').get(hash,Date.now());
    return session?.user_id || null;
  }
  // Keep explicit API credentials available to scripts without reusing a browser's cached Basic login.
  if (req.url?.startsWith('/api/') && !req.headers['sec-fetch-mode'] && req.headers.authorization?.startsWith('Basic ')) {
    if (same(req.headers.authorization,legacyAuth)) {
      const limit = sqlite.prepare('SELECT used FROM auth_limits WHERE bucket=? AND expires>?').get(key('password:'+client(req)),Date.now());
      return limit?.used >= 15 ? null : owner;
    }
    allow('password:'+client(req),15,15*minute);
  }
  return null;
}
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages = new Set(['/','/cards','/brands','/account']);
function nextPage(path) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/';
  const base = 'https://duecue.invalid';
  try {
    const target = new URL(path,base);
    if (target.origin !== base || !pages.has(target.pathname)) return '/';
    return target.pathname + target.search + target.hash;
  } catch { return '/'; }
}
const hidden = (name,value) => '<input type="hidden" name="'+name+'" value="'+esc(value)+'">';
const nextField = next => hidden('next',next);
const formCookie = req => /(?:^|;\s*)__Host-duecue-form=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
function formStart(res, action) {
  let token = formCookie(res.req);
  if (!token) {
    token = randomBytes(32).toString('hex');
    res.setHeader('Set-Cookie','__Host-duecue-form='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict');
  }
  return '<form method="post" action="'+action+'">'+hidden('csrf',token);
}
function trustedForm(req,origin,form) {
  const source = req.headers.origin;
  if (source && source !== 'null') return source === origin;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  // Some WebKit form navigations withhold Origin. Prove the form came from this host.
  const token = formCookie(req);
  return Boolean(token && same(token,form.get('csrf') || ''));
}
function screen(res,status,title,body) {
  res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store, no-transform',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});
  res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="apple-mobile-web-app-title" content="知期"><meta name="apple-mobile-web-app-capable" content="yes"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="icon" href="/favicon.ico"><title>${esc(title)} · 知期</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:#f6f7fb;color:#292833;font:16px/1.55 system-ui,sans-serif}main{width:min(100%,420px);border:1px solid #e1e5ef;border-radius:24px;background:white;padding:clamp(24px,6vw,40px);box-shadow:0 12px 42px #182d5110}header{color:#645687;font-weight:700}h1{font-size:28px;line-height:1.25;margin:22px 0 12px}form{display:grid;gap:14px;margin:22px 0 16px}label{font-size:14px;font-weight:650}input{display:block;width:100%;margin-top:6px;border:1px solid #d3d1df;border-radius:12px;padding:12px;font:inherit;font-size:16px}button{border:0;border-radius:12px;padding:12px;background:#483f63;color:white;font:inherit;font-weight:650;cursor:pointer}p{color:#575461;overflow-wrap:anywhere}form[action="/auth/logout"] button{background:#f3f1f7;color:#534a62}a{color:#483f63;text-underline-offset:3px}.error{color:#962828}</style>
  <main><header>知期 DueCue</header><h1>${esc(title)}</h1>${body}</main></html>`);
}
function redirect(res,location,sessionCookie) {
  res.writeHead(303,{Location:location,'Cache-Control':'no-store',...(sessionCookie?{'Set-Cookie':sessionCookie}:{})}); res.end();
}
const errorLine = text => text ? '<p role="alert" class="error">'+esc(text)+'</p>' : '';
function emailPage(res,next,message='',status=200) {
  screen(res,status,'邮箱注册 / 登录',errorLine(message)+'<p>首次验证邮箱后，即可创建你的个人账本。</p>'+formStart(res,'/auth/send')+nextField(next)+
    '<label>邮箱<input type="email" name="email" autocomplete="email" maxlength="254" required></label><button>发送验证码</button></form><a href="/login?mode=password&amp;next='+encodeURIComponent(next)+'">使用账号密码登录</a>');
}
function passwordPage(res,next,message='',status=200) {
  screen(res,status,'账号密码登录',errorLine(message)+formStart(res,'/auth/password')+nextField(next)+
    '<label>账号<input name="username" autocomplete="username" required></label><label>密码<input type="password" name="password" autocomplete="current-password" required></label><button>登录</button></form><a href="/login?next='+encodeURIComponent(next)+'">使用邮箱验证码</a>');
}
function verifyPage(res,id,email,next,message='',status=200) {
  screen(res,status,'验证邮箱',errorLine(message)+'<p>8 位验证码已发至 '+esc(email)+'，10 分钟内有效。</p>'+formStart(res,'/auth/verify')+hidden('challenge',id)+nextField(next)+
    '<label>验证码<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required autofocus></label><button>验证并登录</button></form><a href="/login?next='+encodeURIComponent(next)+'">返回重新发码</a>');
}
function newSession(user) {
  const token = randomBytes(32).toString('hex');
  sqlite.prepare('INSERT INTO auth_sessions VALUES (?,?,?)').run(key(token),user,Date.now()+sessionSeconds*1000);
  return cookie(token,sessionSeconds);
}
async function readForm(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') return null;
  let size=0; const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>4096) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

export async function accountRoute(req,res,url) {
  const path = url.pathname;
  if (req.method==='GET' && (path==='/login' || path==='/account')) {
    const next = nextPage(url.searchParams.get('next'));
    const user = identity(req);
    if (user) {
      if (path==='/login') { redirect(res,next); return; }
      const email = sqlite.prepare('SELECT email FROM auth_accounts WHERE id=?').get(user)?.email;
      screen(res,200,'我的账号','<p>'+esc(email || owner)+'</p><a href="/#settings">返回设置</a>'+formStart(res,'/auth/logout')+'<button>退出登录</button></form>');
    } else if (url.searchParams.get('mode')==='password') passwordPage(res,next);
    else emailPage(res,next);
    return;
  }
  if ((req.method==='GET' || req.method==='HEAD') && ['/auth/send','/auth/password','/auth/verify','/auth/logout'].includes(path)) {
    return redirect(res,path==='/auth/password' ? '/login?mode=password' : '/login');
  }
  if (req.method!=='POST') {
    screen(res,405,'请从登录页继续','<a href="/login">打开登录页</a>'); return;
  }
  const form=await readForm(req);
  if (!form) { screen(res,400,'表单无效','<a href="/login">重新登录</a>'); return; }
  if (!trustedForm(req,url.origin,form)) {
    const retry = path==='/auth/password' ? '/login?mode=password' : '/login';
    screen(res,403,'请重新打开登录页','<p>当前表单无法验证，请重新打开后提交。</p><a href="'+retry+'">重新打开登录页</a>'); return;
  }
  const next=nextPage(form.get('next'));
  if (path==='/auth/logout') {
    sqlite.prepare('DELETE FROM auth_sessions WHERE hash=?').run(sessionHash(req));
    redirect(res,'/login',cookie('',0)); return;
  }
  if (path==='/auth/password') {
    const bucket = 'password:'+client(req);
    if (!allow(bucket,15,15*minute)) { passwordPage(res,next,'尝试次数过多，请在 15 分钟后重试。',429); return; }
    if (form.get('username')!==owner || !same(form.get('password') || '',ownerPassword)) {
      passwordPage(res,next,'账号或密码有误。',401); return;
    }
    sqlite.prepare('DELETE FROM auth_limits WHERE bucket=?').run(key(bucket));
    redirect(res,next,newSession(owner)); return;
  }
  if (path==='/auth/send') {
    const email=(form.get('email') || '').trim().toLowerCase();
    if (email.length>254 || !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email)) {
      emailPage(res,next,'请输入有效的邮箱地址。',400); return;
    }
    if (!allow('mail-ip:'+client(req),12,15*minute) || !allow('mail-cooldown:'+email,1,minute) ||
        !allow('mail-hour:'+email,5,60*minute) || !allow('mail-total',150,60*minute)) {
      emailPage(res,next,'发送过于频繁，请稍后再试。',429); return;
    }
    const id=randomBytes(20).toString('hex');
    const code=String(randomInt(100000000)).padStart(8,'0');
    sqlite.prepare('INSERT INTO auth_codes (id,email,digest,expires) VALUES (?,?,?,?)')
      .run(id,email,codeDigest(id,code),Date.now()+10*minute);
    try {
      const result=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(12000),
        headers:{Authorization:'Bearer '+mailKey,'Content-Type':'application/json','Idempotency-Key':id},
        body:JSON.stringify({from,to:[email],subject:'知期邮箱验证码',text:'你的知期验证码是 '+code+'，10 分钟内有效。请在知期注册或登录页面输入此码。若非本人操作，可忽略此邮件。'})});
      if (!result.ok || !(await result.json()).id) throw Error('Resend send failed');
    } catch {
      sqlite.prepare('DELETE FROM auth_codes WHERE id=?').run(id);
      emailPage(res,next,'验证码暂未发出，请稍后重试。',503); return;
    }
    verifyPage(res,id,email,next); return;
  }
  if (path==='/auth/verify') {
    const id=form.get('challenge') || '';
    const row=sqlite.prepare('SELECT * FROM auth_codes WHERE id=? AND expires>? AND attempts<5').get(id,Date.now());
    if (!row) { emailPage(res,next,'验证码已失效，请重新获取。',400); return; }
    if (!same(row.digest,codeDigest(id,form.get('code') || ''))) {
      sqlite.prepare('UPDATE auth_codes SET attempts=attempts+1 WHERE id=?').run(id);
      verifyPage(res,id,row.email,next,'验证码有误，请重新输入。',400); return;
    }
    sqlite.exec('BEGIN IMMEDIATE');
    let session;
    try {
      sqlite.prepare('DELETE FROM auth_codes WHERE id=?').run(id);
      sqlite.prepare('INSERT INTO auth_accounts VALUES (?,?) ON CONFLICT(email) DO NOTHING').run(randomUUID(),row.email);
      const user=sqlite.prepare('SELECT id FROM auth_accounts WHERE email=?').get(row.email);
      session=newSession(user.id);
      sqlite.exec('COMMIT');
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    redirect(res,next,session); return;
  }
  screen(res,404,'页面不存在','<a href="/login">返回登录</a>');
}
