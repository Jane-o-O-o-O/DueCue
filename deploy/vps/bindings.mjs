import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dataDirectory = process.env.DUECUE_DATA || './data';
mkdirSync(dataDirectory, {recursive:true});
const sqlite = new DatabaseSync(join(dataDirectory, 'duecue.sqlite'));
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
const schemaVersion = sqlite.prepare('PRAGMA user_version').get().user_version;
if (schemaVersion === 0) {
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url),'utf8'));
    sqlite.exec('PRAGMA user_version=1; COMMIT');
  } catch (error) {
    sqlite.exec('ROLLBACK');
    throw error;
  }
} else if (schemaVersion !== 1) {
  throw Error('Unsupported DueCue database version');
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
for (const name of ['OPENAI_API_KEY','PLAN_PRICE_CNY','PLAN_DAYS','ALIPAY_APP_ID',
  'ALIPAY_SELLER_ID','ALIPAY_PUBLIC_KEY','ALIPAY_PRIVATE_KEY','ALIPAY_NOTIFY_URL']) {
  if (process.env[name]) env[name] = process.env[name].replaceAll('\\n','\n');
}
