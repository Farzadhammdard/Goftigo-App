import initSqlJs, {Database as SqlJsDatabase} from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'goftgoo.db');

let db: SqlJsDatabase | null = null;
let dirty = false;

export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  return db;
}

export function markDirty(): void {
  dirty = true;
}

export function saveDb(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    dirty = false;
  }
}

setInterval(() => {
  if (dirty && db) {
    saveDb();
  }
}, 5000);

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
