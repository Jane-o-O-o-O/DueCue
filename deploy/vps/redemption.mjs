import {createHash, randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {sqlite} from './bindings.mjs';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const day = 86400000;
const digest = code => createHash('sha256').update(code).digest('hex');

export function issueCode(days, permanent = false) {
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw Error('请输入 1 至 3650 之间的整数天数。');
  }
  const groups = Array.from(randomBytes(16), byte => alphabet[byte % alphabet.length]).join('').match(/.{4}/g);
  const code = 'ZQ-' + groups.join('-');
  sqlite.prepare('INSERT INTO redemption_codes(digest,days,created_at,permanent) VALUES (?,?,?,?)')
    .run(digest(code.replaceAll('-','')), days, Date.now(), Number(permanent));
  return code;
}

export function redeemCode(user, input) {
  const normalized = typeof input === 'string' ? input.toUpperCase().replace(/[\s-]/g,'') : '';
  const unavailable = {error:'兑换码无效或已被使用，请核对后再试。'};
  if (!/^ZQ[A-HJ-NP-Z2-9]{16}$/.test(normalized)) return unavailable;
  const hash = digest(normalized);
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    const code = sqlite.prepare('SELECT days,used_by,permanent FROM redemption_codes WHERE digest=?').get(hash);
    let result = unavailable;
    if (code && (code.used_by === null || code.used_by === user)) {
      const alreadyRedeemed = code.used_by !== null;
      const membership = sqlite.prepare('SELECT started,paid_until,permanent FROM members WHERE owner=?');
      if (!alreadyRedeemed) {
        if (membership.get(user)?.permanent === 1) {
          sqlite.exec('COMMIT');
          return {error:'你的永久使用权益已生效，这枚兑换码仍可使用。'};
        }
        const now = Date.now();
        sqlite.prepare('INSERT OR IGNORE INTO members(owner,started) VALUES (?,?)').run(user,now);
        if (code.permanent) {
          sqlite.prepare('UPDATE members SET permanent=1 WHERE owner=?').run(user);
        } else {
          sqlite.prepare('UPDATE members SET paid_until=max(paid_until, started+?, ?)+? WHERE owner=?')
            .run(7*day,now,code.days*day,user);
        }
        sqlite.prepare('UPDATE redemption_codes SET used_by=?,used_at=? WHERE digest=?').run(user,now,hash);
      }
      const {started,paid_until,permanent} = membership.get(user);
      const now = Date.now();
      const end = permanent ? 0 : Math.max(started + 7*day, paid_until);
      result = {
        days: code.permanent ? null : code.days,
        permanent: Boolean(code.permanent),
        alreadyRedeemed,
        member: {started, end, active: Boolean(permanent) || end > now, paid: Boolean(permanent) || paid_until > now, permanent: Boolean(permanent)},
      };
    }
    sqlite.exec('COMMIT');
    return result;
  } catch (error) {
    sqlite.exec('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [action, duration, quantity = '1'] = process.argv.slice(2);
  const count = Number(quantity);
  if (action !== 'issue' || !duration || process.argv.length > 5 ||
      !/^[1-9][0-9]*$/.test(quantity) || count > 100) {
    console.error('用法：node redemption.mjs issue <天数|permanent> [数量]');
    process.exitCode = 1;
  } else {
    const permanent = duration === 'permanent';
    const days = permanent ? 1 : Number(duration);
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const codes = Array.from({length: count}, () => issueCode(days, permanent));
      sqlite.exec('COMMIT');
      process.stdout.write(codes.join('\n') + '\n');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
