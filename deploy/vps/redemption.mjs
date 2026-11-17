import {createHash, randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {sqlite} from './bindings.mjs';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const day = 86400000;
const digest = code => createHash('sha256').update(code).digest('hex');
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS redemption_codes (
    digest TEXT PRIMARY KEY NOT NULL,
    days INTEGER NOT NULL CHECK (days BETWEEN 1 AND 3650),
    created_at INTEGER NOT NULL,
    used_by TEXT,
    used_at INTEGER,
    CHECK ((used_by IS NULL) = (used_at IS NULL))
  )
`);

export function issueCode(days) {
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw Error('请输入 1 至 3650 之间的整数天数。');
  }
  const groups = Array.from(randomBytes(16), byte => alphabet[byte % alphabet.length]).join('').match(/.{4}/g);
  const code = 'ZQ-' + groups.join('-');
  sqlite.prepare('INSERT INTO redemption_codes(digest,days,created_at) VALUES (?,?,?)')
    .run(digest(code.replaceAll('-','')), days, Date.now());
  return code;
}

export function redeemCode(user, input) {
  const normalized = typeof input === 'string' ? input.toUpperCase().replace(/[\s-]/g,'') : '';
  const unavailable = {error:'兑换码无效或已被使用，请核对后再试。'};
  if (!/^ZQ[A-HJ-NP-Z2-9]{16}$/.test(normalized)) return unavailable;
  const hash = digest(normalized);
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    const code = sqlite.prepare('SELECT days,used_by FROM redemption_codes WHERE digest=?').get(hash);
    let result = unavailable;
    if (code && (code.used_by === null || code.used_by === user)) {
      const alreadyRedeemed = code.used_by !== null;
      if (!alreadyRedeemed) {
        const now = Date.now();
        // Match paid renewals: keep the entire trial and all remaining credited time.
        sqlite.prepare('INSERT OR IGNORE INTO members(owner,started) VALUES (?,?)').run(user,now);
        sqlite.prepare('UPDATE members SET paid_until=max(paid_until, started+?, ?)+? WHERE owner=?')
          .run(7*day,now,code.days*day,user);
        sqlite.prepare('UPDATE redemption_codes SET used_by=?,used_at=? WHERE digest=?').run(user,now,hash);
      }
      const {started,paid_until} = sqlite.prepare('SELECT started,paid_until FROM members WHERE owner=?').get(user);
      const active = paid_until > Date.now();
      result = {days:code.days, alreadyRedeemed, member:{started, end:paid_until, active, paid:active}};
    }
    sqlite.exec('COMMIT');
    return result;
  } catch (error) {
    sqlite.exec('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4 || process.argv[2] !== 'issue') {
    console.error('用法：node redemption.mjs issue 天数');
    process.exitCode = 1;
  } else {
    try { console.log(issueCode(Number(process.argv[3]))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
