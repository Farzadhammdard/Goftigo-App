import {Database as SqlJsDatabase} from 'sql.js';

// sql.js helper: run a query and return all rows as objects
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

// sql.js helper: run a query and return one row as object, or undefined
export function queryOne(db: SqlJsDatabase, sql: string, params: any[] = []): Record<string, any> | undefined {
  const rows = queryAll(db, sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

// sql.js helper: run a query and return the first column of the first row
export function queryScalar(db: SqlJsDatabase, sql: string, params: any[] = []): any {
  const row = queryOne(db, sql, params);
  if (!row) return null;
  const keys = Object.keys(row);
  return keys.length > 0 ? row[keys[0]] : null;
}

// sql.js helper: run a statement (INSERT/UPDATE/DELETE)
export function runStatement(db: SqlJsDatabase, sql: string, params: any[] = []): void {
  db.run(sql, params);
}
