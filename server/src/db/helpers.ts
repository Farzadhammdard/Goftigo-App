import {Database as SqlJsDatabase} from 'sql.js';
import {markDirty} from './connection';

export function queryAll(db: SqlJsDatabase, sql: string, params: any[] = []): Record<string, any>[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: Record<string, any>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(db: SqlJsDatabase, sql: string, params: any[] = []): Record<string, any> | undefined {
  const rows = queryAll(db, sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

export function queryScalar(db: SqlJsDatabase, sql: string, params: any[] = []): any {
  const row = queryOne(db, sql, params);
  if (!row) return null;
  const keys = Object.keys(row);
  return keys.length > 0 ? row[keys[0]] : null;
}

export function runStatement(db: SqlJsDatabase, sql: string, params: any[] = []): void {
  db.run(sql, params);
  markDirty();
}
