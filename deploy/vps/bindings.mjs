import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';
import { DAY_MS } from './membership.mjs';

const dataDirectory = process.env.DUECUE_DATA || './data';
mkdirSync(dataDirectory, {recursive:true});
export const sqlite = new DatabaseSync(join(dataDirectory, 'duecue.sqlite'));
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
const schemaVersion = () => sqlite.prepare('PRAGMA user_version').get().user_version;
if (schemaVersion() !== 4) {
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    const version = schemaVersion();
    if (version > 4) throw Error('Unsupported DueCue database version');
    if (version < 3) {
      sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url),'utf8'));
      if (!sqlite.prepare('PRAGMA table_info(members)').all().some(column => column.name === 'permanent')) {
        sqlite.exec('ALTER TABLE members ADD COLUMN permanent INTEGER NOT NULL DEFAULT 0 CHECK (permanent IN (0,1))');
      }
      if (!sqlite.prepare('PRAGMA table_info(redemption_codes)').all().some(column => column.name === 'permanent')) {
        sqlite.exec('ALTER TABLE redemption_codes ADD COLUMN permanent INTEGER NOT NULL DEFAULT 0 CHECK (permanent IN (0,1))');
      }
    }
    if (version < 4) {
      // The previous trial was seven days. Preserve finite extensions when adding the extra 23 days.
      sqlite.prepare('UPDATE members SET paid_until=paid_until+? WHERE permanent=0 AND paid_until>0')
        .run(23 * DAY_MS);
      sqlite.exec('PRAGMA user_version=4');
    }
    sqlite.exec('COMMIT');
  } catch (error) {
    sqlite.exec('ROLLBACK');
    throw error;
  }
}

class Statement {
  constructor(statement, values = []) {
    this.statement = statement;
    this.values = values;
  }
  bind(...values) { return new Statement(this.statement, values); }
  first() { return this.statement.get(...this.values) ?? null; }
  all() { return {results: this.statement.all(...this.values)}; }
  run() { return this.statement.run(...this.values); }
}

const DB = {
  prepare(sql) { return new Statement(sqlite.prepare(sql)); },
  batch(statements) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const result = statements.map(statement => statement.run());
      sqlite.exec('COMMIT');
      return result;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  },
};

export const env = {DB};
for (const name of ['SCREENSHOT_MODEL_URL','SCREENSHOT_OPENAI_API_KEY','SCREENSHOT_OPENAI_BASE_URL','OPENAI_API_KEY']) {
  if (process.env[name]) env[name] = process.env[name].replaceAll('\\n','\n');
}

// Use the application's inference deadline even if the private model has a queue.
// Node's default fetch has an independent five-minute response-header timeout.
if (env.SCREENSHOT_MODEL_URL) {
  const endpoint = new URL(env.SCREENSHOT_MODEL_URL);
  const request = endpoint.protocol === 'https:' ? httpsRequest : httpRequest;
  env.callScreenshotModel = (body, signal) => new Promise((resolve, reject) => {
    const call = request(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, signal}, incoming => {
      resolve(new Response(Readable.toWeb(incoming), {
        status: incoming.statusCode,
        headers: {'Content-Type': 'application/json'},
      }));
    });
    call.on('error', reject);
    call.end(body);
  });
}
