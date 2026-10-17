import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
/** D1-compatible adapter; the same handler runs locally and on Cloudflare. */
export function createDatabase(path = ':memory:') {
  const sqlite = new DatabaseSync(path);
  for (const file of readdirSync(new URL('./migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`./migrations/${file}`, import.meta.url), 'utf8'));
  }
  class Statement {
    constructor(sql, args = []) { this.sql = sql; this.args = args; }
    bind(...args) { return new Statement(this.sql, args); }
    async first() { return sqlite.prepare(this.sql).get(...this.args) || null; }
    async all() { return { results: sqlite.prepare(this.sql).all(...this.args) }; }
    async run() { const info = sqlite.prepare(this.sql).run(...this.args); return { meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } }; }
  }
  return { prepare: sql => new Statement(sql), async batch(statements) {
    sqlite.exec('BEGIN IMMEDIATE');
    try { const result = []; for (const stmt of statements) { const info=sqlite.prepare(stmt.sql).run(...stmt.args);result.push({meta:{changes:Number(info.changes),last_row_id:Number(info.lastInsertRowid)}}); } sqlite.exec('COMMIT'); return result; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }, close: () => sqlite.close() };
}
