import {createHash, createHmac, randomBytes, randomInt, randomUUID, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
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
  CREATE TABLE IF NOT EXISTS auth_profiles (
    user_id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL DEFAULT '',
    password_hash TEXT
  );
  CREATE TABLE IF NOT EXISTS auth_password_setup (
    hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL,
    next TEXT NOT NULL, replace_existing INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS auth_password_setup_expiry ON auth_password_setup(expires);
  CREATE TABLE IF NOT EXISTS auth_sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires);
  CREATE TABLE IF NOT EXISTS auth_codes (id TEXT PRIMARY KEY, email TEXT NOT NULL, digest TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX IF NOT EXISTS auth_codes_expiry ON auth_codes(expires);
  CREATE TABLE IF NOT EXISTS auth_limits (bucket TEXT PRIMARY KEY, used INTEGER NOT NULL, expires INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS auth_limits_expiry ON auth_limits(expires);
`);

const minute = 60000;
const codeLength = 6;
const codeMinutes = 10;
const sixDigitChallenge = 'otp6-';
// A challenge sent before the six-digit rollout keeps its original format until expiry.
const challengeLength = id => id.startsWith(sixDigitChallenge) ? codeLength : 8;
const sessionSeconds = 30 * 86400;
const setupSeconds = 15 * 60;
const setupCookieName = '__Host-duecue-setup';
const scryptAsync = promisify(scrypt);
const derivation = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const lookupAccount = email => sqlite.prepare(`
  SELECT a.id,a.email,p.nickname,p.password_hash FROM auth_accounts a
  LEFT JOIN auth_profiles p ON p.user_id=a.id WHERE a.email=?`).get(email);
const validPassword = password => password.length >= 8 && password.length <= 128;

async function encodePassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 32, derivation);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
async function matchesPassword(password, encoded) {
  const [salt, expected] = (encoded || '0'.repeat(32) + ':' + '0'.repeat(64)).split(':');
  const hash = await scryptAsync(password, Buffer.from(salt, 'hex'), 32, derivation);
  return timingSafeEqual(hash, Buffer.from(expected, 'hex')) && Boolean(encoded);
}
const digest = value => createHash('sha256').update(value).digest();
const key = value => digest(value).toString('hex');
const same = (a,b) => timingSafeEqual(digest(a),digest(b));
const codeDigest = (id,code) => createHmac('sha256',secret).update(id + ':' + code).digest('hex');
const legacyAuth = 'Basic ' + Buffer.from(owner + ':' + ownerPassword).toString('base64');
const cookieName = '__Host-duecue';
const cookie = (value,age) => cookieName+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;
const setupCookie = (value, age) => setupCookieName+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+age;
function pendingPassword(req) {
  const token = /(?:^|;\s*)__Host-duecue-setup=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  return token ? sqlite.prepare('SELECT * FROM auth_password_setup WHERE hash=? AND expires>?')
    .get(key(token),Date.now()) : undefined;
}
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
  for (const table of ['auth_sessions','auth_codes','auth_limits','auth_password_setup']) {
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
const formTokens = new WeakMap();
function formStart(res, action) {
  let token = formCookie(res.req) || formTokens.get(res);
  if (!token) {
    token = randomBytes(32).toString('hex');
    formTokens.set(res, token);
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
  *{box-sizing:border-box}
  body{margin:0;min-height:100svh;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) 18px max(20px,env(safe-area-inset-bottom));background:#f4f4f9;color:#25233a;font:16px/1.5 system-ui,sans-serif}
  main{width:min(100%,422px);border:1px solid #e5e2ef;border-radius:26px;background:white;padding:clamp(21px,6vw,34px);box-shadow:0 16px 44px #26204c0d}
  header{display:flex;align-items:center;gap:9px;color:#4c4366;font-weight:720}
  header img{width:30px;height:30px;border-radius:8px}
  h1{font-size:28px;line-height:1.25;letter-spacing:-.035em;margin:22px 0 10px}
  form{display:grid;gap:14px;margin:18px 0 12px}
  label{font-size:14px;font-weight:650}
  input{display:block;width:100%;margin-top:6px;min-height:46px;border:1px solid #ddd9ea;border-radius:12px;background:#fbfaff;padding:10px 12px;font:inherit;font-size:16px;color:#29253a}
  button{border:0;border-radius:12px;min-height:46px;padding:9px 12px;background:#514171;color:white;font:inherit;font-weight:700;cursor:pointer}
  p{margin:8px 0;color:#605a70;overflow-wrap:anywhere}
  a{color:#514171;text-underline-offset:3px}
  :is(input,button,a):focus-visible{outline:3px solid #aa98d8;outline-offset:2px}
  .methods{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;margin:18px 0 14px;background:#f0eef6;border-radius:13px}
  .methods a{display:grid;place-items:center;min-height:40px;text-decoration:none;font-size:14px;font-weight:650;text-align:center;border-radius:10px}
  .methods [aria-current]{background:#fff;color:#302446;box-shadow:0 1px 5px #29204012}
  .account-id{margin:16px 0;padding:12px 14px;border-radius:14px;background:#f6f4fb;color:#362d4c;overflow-wrap:anywhere;font-weight:650}
  .account-id small{display:block;font-size:12px;color:#665d76;font-weight:500}
  .account-links{display:grid;gap:11px;border-top:1px solid #edebf3;padding-top:14px;margin-top:20px}
  form[action="/auth/logout"]{margin-top:8px}
  form[action="/auth/logout"] button{background:#f7f1f3;color:#783d51}
  .success,.error{padding:9px 11px;border-radius:10px;font-size:14px}
  .success{color:#245c46;background:#edf8f2}.error{color:#962828;background:#fff2f2}</style>
  <main><header><img src="/apple-touch-icon.png" alt="">知期</header><h1>${esc(title)}</h1>${body}</main></html>`);
}
function redirect(res,location,sessionCookie) {
  res.writeHead(303,{Location:location,'Cache-Control':'no-store',...(sessionCookie?{'Set-Cookie':sessionCookie}:{})}); res.end();
}
const errorLine = text => text ? '<p role="alert" class="error">'+esc(text)+'</p>' : '';
function methodLinks(next, method) {
  const tail = '&amp;next='+encodeURIComponent(next);
  return '<nav class="methods" aria-label="登录方式">'+
    '<a href="/login?mode=password'+tail+'"'+(method==='password'?' aria-current="page"':'')+'>账号密码</a>'+
    '<a href="/login?mode=email'+tail+'"'+(method==='email'?' aria-current="page"':'')+'>邮箱登录或注册</a></nav>';
}
function emailPage(res,next,message='',status=200,setup=false,email='') {
  const mode = setup ? hidden('setup','1') : '';
  screen(res,status,setup?'通过邮箱设置密码':'登录知期',
    (setup?'':methodLinks(next,'email'))+errorLine(message)+
    '<p>'+(setup?'验证邮箱后，输入两次新密码。':'已注册用户验证邮箱后直接登录。首次使用时，验证后会请你设置密码。')+'</p>'+
    formStart(res,'/auth/send')+mode+nextField(next)+
    '<label>邮箱<input type="email" name="email" autocomplete="email" maxlength="254" value="'+esc(email)+'" required></label>'+
    '<button>发送验证码</button></form>');
}
function passwordPage(res,next,message='',status=200) {
  screen(res,status,'登录知期',methodLinks(next,'password')+errorLine(message)+formStart(res,'/auth/password')+nextField(next)+
    '<label>账号<input name="username" placeholder="注册邮箱" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="254" required></label>'+
    '<label>密码<input type="password" name="password" autocomplete="current-password" maxlength="128" required></label>'+
    '<button>登录</button></form><a href="/login?mode=setup&amp;next='+encodeURIComponent(next)+'">忘记密码？</a>');
}
function verifyPage(res,id,email,next,message='',status=200,setup=false) {
  const back = '/login?mode='+(setup?'setup':'email')+'&amp;next='+encodeURIComponent(next);
  const digits = challengeLength(id);
  screen(res,status,'验证邮箱',errorLine(message)+'<p>'+digits+' 位验证码已发至 '+esc(email)+'，'+codeMinutes+' 分钟内有效。</p>'+
    formStart(res,'/auth/verify')+hidden('challenge',id)+(setup?hidden('setup','1'):'')+nextField(next)+
    '<label>验证码<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{'+digits+'}" maxlength="'+digits+'" required autofocus></label>'+
    '<button>验证并继续</button></form><a href="'+back+'">返回重新发码</a>');
}
function verificationEmail(email, code) {
  const subject = '知期邮箱验证码';
  const expiry = `验证码在 ${codeMinutes} 分钟内有效，请勿转发。`;
  const ignore = '如果你没有发起此操作，可以忽略这封邮件。';
  const text = `你的知期验证码是 ${code}。\n在知期输入验证码即可继续。${expiry}\n\n${ignore}`;
  const html = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;background:#f3f1f8;color:#252139;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">使用验证码完成知期的邮箱验证，有效期 ${codeMinutes} 分钟。</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f1f8;">
    <tr><td align="center" style="padding:32px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#fff;border:1px solid #e7e2f1;border-radius:22px;">
        <tr><td style="padding:30px 24px 24px;">
          <p style="margin:0 0 18px;color:#5f4c83;font-size:16px;font-weight:700;">知期</p>
          <h1 style="margin:0 0 8px;font-size:25px;line-height:1.3;letter-spacing:-0.02em;">邮箱验证码</h1>
          <p style="margin:0;color:#59516a;font-size:15px;line-height:1.6;">在知期输入下方验证码即可继续。</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 14px;">
            <tr><td align="center" style="padding:20px 12px;background:#f2ecfa;border:1px solid #e8ddf4;border-radius:14px;color:#392b58;font:700 36px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.15em;">${code}</td></tr>
          </table>
          <p style="margin:0;color:#59516a;font-size:13px;line-height:1.6;">${expiry}</p>
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #eeeaf4;color:#665f75;font-size:13px;line-height:1.6;">${ignore}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return {from,to:[email],subject,text,html};
}
function setupPage(res,pending,message='',status=200) {
  screen(res,status,'设置登录密码',errorLine(message)+'<p>邮箱已验证。输入两次相同的密码，以后就能用这个邮箱和密码登录。</p>'+
    '<div class="account-id"><small>账号</small>'+esc(pending.email)+'</div>'+formStart(res,'/auth/setup')+
    '<label>新密码<input type="password" name="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="至少 8 个字符" required></label>'+
    '<label>确认密码<input type="password" name="confirm" autocomplete="new-password" minlength="8" maxlength="128" required></label>'+
    '<button>保存密码并登录</button></form><a href="/login?mode=setup">重新验证邮箱</a>');
}
function profilePage(res,user,{notice='',error='',status=200}={}) {
  const profile=sqlite.prepare(`SELECT a.email,p.nickname,p.password_hash FROM (SELECT ? AS id) u
    LEFT JOIN auth_accounts a ON a.id=u.id LEFT JOIN auth_profiles p ON p.user_id=u.id`).get(user);
  const account = '<div class="account-id"><small>账号</small>'+esc(profile?.email || owner)+'</div>';
  const noticeLine = notice ? '<p class="success" role="status">'+esc(notice)+'</p>' : '';
  const passwordLink = profile?.email
    ? '<a href="/login?mode=setup&amp;next=%2Faccount">'+(profile.password_hash?'修改密码':'设置密码')+'</a>' : '';
  screen(res,status,'我的账号',noticeLine+errorLine(error)+account+
    formStart(res,'/auth/nickname')+'<label>昵称<input name="nickname" autocomplete="nickname" maxlength="48" value="'+esc(profile?.nickname || '')+
    '" placeholder="输入昵称"></label><button>保存昵称</button></form>'+
    '<div class="account-links">'+passwordLink+'<a href="/#settings">返回设置</a></div>'+
    formStart(res,'/auth/logout')+'<button>退出登录</button></form>');
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
  if (req.method==='GET' && path==='/auth/setup') {
    const pending=pendingPassword(req);
    if (!pending) return emailPage(res,'/','验证已过期，请重新获取验证码。',400,true);
    return setupPage(res,pending);
  }
  if (req.method==='GET' && (path==='/login' || path==='/account')) {
    const next = nextPage(url.searchParams.get('next'));
    const user = identity(req);
    if (path==='/account') {
      if (!user) return redirect(res,'/login?next=%2Faccount');
      return profilePage(res,user,{notice:url.searchParams.get('saved')==='nickname'?'昵称已保存。':''});
    }
    const mode = url.searchParams.get('mode');
    if (mode==='setup') {
      const account = user ? sqlite.prepare('SELECT email FROM auth_accounts WHERE id=?').get(user) : undefined;
      return emailPage(res,next,'',200,true,account?.email);
    }
    if (user) return redirect(res,next);
    if (mode==='email') return emailPage(res,next);
    return passwordPage(res,next);
  }
  if ((req.method==='GET' || req.method==='HEAD') && ['/auth/send','/auth/password','/auth/verify','/auth/logout','/auth/nickname'].includes(path)) {
    return redirect(res,['/auth/send','/auth/verify'].includes(path) ? '/login?mode=email' : '/login');
  }
  if (req.method!=='POST') {
    screen(res,405,'请从登录页继续','<a href="/login">打开登录页</a>'); return;
  }
  const form=await readForm(req);
  if (!form) { screen(res,400,'表单无效','<a href="/login">重新登录</a>'); return; }
  if (!trustedForm(req,url.origin,form)) {
    const retry = ['/auth/send','/auth/verify'].includes(path) ? '/login?mode=email' : '/login';
    screen(res,403,'请重新打开登录页','<p>当前表单无法验证，请重新打开后提交。</p><a href="'+retry+'">重新打开登录页</a>'); return;
  }
  const next=nextPage(form.get('next'));
  if (path==='/auth/logout') {
    sqlite.prepare('DELETE FROM auth_sessions WHERE hash=?').run(sessionHash(req));
    const pending=pendingPassword(req);
    if (pending) sqlite.prepare('DELETE FROM auth_password_setup WHERE hash=?').run(pending.hash);
    redirect(res,'/login',[cookie('',0),setupCookie('',0)]); return;
  }
  if (path==='/auth/nickname') {
    const user=identity(req);
    if (!user) return redirect(res,'/login?next=%2Faccount');
    const nickname=(form.get('nickname') || '').trim();
    if ([...nickname].length>24 || /[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(nickname)) {
      return profilePage(res,user,{error:'昵称请使用 24 个字符以内的可见文字。',status:400});
    }
    sqlite.prepare(`INSERT INTO auth_profiles(user_id,nickname) VALUES (?,?)
      ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname`).run(user,nickname);
    return redirect(res,'/account?saved=nickname');
  }
  if (path==='/auth/password') {
    const username=(form.get('username') || '').trim();
    const password=form.get('password') || '';
    const ipBucket='password:'+client(req);
    const accountBucket='password-account:'+username.toLowerCase();
    if (!allow(ipBucket,15,15*minute) || !allow(accountBucket,10,15*minute)) {
      return passwordPage(res,next,'尝试次数过多，请在 15 分钟后重试。',429);
    }
    let user;
    if (username===owner && same(password,ownerPassword)) user=owner;
    else if (username.length<=254 && validPassword(password)) {
      const account=lookupAccount(username.toLowerCase());
      if (await matchesPassword(password,account?.password_hash)) user=account.id;
    }
    if (!user) return passwordPage(res,next,'账号或密码有误。',401);
    sqlite.prepare('DELETE FROM auth_limits WHERE bucket IN (?,?)').run(key(ipBucket),key(accountBucket));
    redirect(res,next,newSession(user)); return;
  }
  if (path==='/auth/setup') {
    const pending=pendingPassword(req);
    if (!pending) return emailPage(res,'/','验证已过期，请重新获取验证码。',400,true);
    const password=form.get('password') || '';
    if (!validPassword(password)) return setupPage(res,pending,'密码需为 8 至 128 个字符。',400);
    if (password!==form.get('confirm')) return setupPage(res,pending,'两次输入的密码不一致。',400);
    const encoded=await encodePassword(password);
    sqlite.exec('BEGIN IMMEDIATE');
    let session;
    try {
      const active=sqlite.prepare('DELETE FROM auth_password_setup WHERE hash=? AND expires>? RETURNING *')
        .get(pending.hash,Date.now());
      if (active) {
        const existing=lookupAccount(active.email);
        if (!existing || active.replace_existing) {
          const user=existing?.id || randomUUID();
          if (!existing) sqlite.prepare('INSERT INTO auth_accounts(id,email) VALUES (?,?)').run(user,active.email);
          sqlite.prepare(`INSERT INTO auth_profiles(user_id,password_hash) VALUES (?,?)
            ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash`).run(user,encoded);
          if (existing) sqlite.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(user);
          session=newSession(user);
        }
      }
      sqlite.exec('COMMIT');
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    if (!session) return emailPage(res,pending.next,'请重新验证邮箱后继续。',400,true,pending.email);
    return redirect(res,pending.next,[session,setupCookie('',0)]);
  }
  if (path==='/auth/send') {
    const setup=form.get('setup')==='1';
    const email=(form.get('email') || '').trim().toLowerCase();
    if (email.length>254 || !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email)) {
      emailPage(res,next,'请输入有效的邮箱地址。',400,setup,email); return;
    }
    if (!allow('mail-ip:'+client(req),12,15*minute) || !allow('mail-cooldown:'+email,1,minute) ||
        !allow('mail-hour:'+email,5,60*minute) || !allow('mail-total',150,60*minute)) {
      emailPage(res,next,'发送过于频繁，请稍后再试。',429,setup,email); return;
    }
    const id=sixDigitChallenge+randomBytes(20).toString('hex');
    const code=String(randomInt(10 ** codeLength)).padStart(codeLength,'0');
    sqlite.prepare('INSERT INTO auth_codes (id,email,digest,expires) VALUES (?,?,?,?)')
      .run(id,email,codeDigest(id,code),Date.now()+codeMinutes*minute);
    try {
      const result=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(12000),
        headers:{Authorization:'Bearer '+mailKey,'Content-Type':'application/json','Idempotency-Key':id},
        body:JSON.stringify(verificationEmail(email,code))});
      if (!result.ok || !(await result.json()).id) throw Error('Resend send failed');
    } catch {
      sqlite.prepare('DELETE FROM auth_codes WHERE id=?').run(id);
      emailPage(res,next,'验证码暂未发出，请稍后重试。',503,setup,email); return;
    }
    verifyPage(res,id,email,next,'',200,setup); return;
  }
  if (path==='/auth/verify') {
    const setup=form.get('setup')==='1';
    const id=form.get('challenge') || '';
    const row=sqlite.prepare('SELECT * FROM auth_codes WHERE id=? AND expires>? AND attempts<5').get(id,Date.now());
    if (!row) return emailPage(res,next,'验证码已失效，请重新获取。',400,setup);
    const code=form.get('code') || '';
    if (code.length!==challengeLength(id) || !/^\d+$/.test(code) || !same(row.digest,codeDigest(id,code))) {
      sqlite.prepare('UPDATE auth_codes SET attempts=attempts+1 WHERE id=?').run(id);
      return verifyPage(res,id,row.email,next,'验证码有误，请重新输入。',400,setup);
    }
    sqlite.exec('BEGIN IMMEDIATE');
    let session, token;
    try {
      sqlite.prepare('DELETE FROM auth_codes WHERE id=?').run(id);
      const existing=lookupAccount(row.email);
      if (existing && !setup) session=newSession(existing.id);
      else {
        token=randomBytes(32).toString('hex');
        sqlite.prepare('INSERT INTO auth_password_setup VALUES (?,?,?,?,?)')
          .run(key(token),row.email,Date.now()+setupSeconds*1000,next,setup ? 1 : 0);
      }
      sqlite.exec('COMMIT');
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    if (token) return redirect(res,'/auth/setup',setupCookie(token,setupSeconds));
    redirect(res,next,session); return;
  }
  screen(res,404,'页面不存在','<a href="/login">返回登录</a>');
}
