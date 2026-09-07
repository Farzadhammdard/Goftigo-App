const sql = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');

(async () => {
  const SQL = await sql();
  const dbBuf = fs.readFileSync('data/goftgoo.db');
  const db = new SQL.Database(dbBuf);

  // 1. Check current users
  const users = db.exec("SELECT id, username, password_hash FROM users");
  console.log('Current users:', JSON.stringify(users, null, 2));

  // 2. Keep only farzad and ali
  const keep = ['farzad', 'ali', 'goftegoo_admin'];
  const placeholders = keep.map(() => '?').join(',');
  const del = db.exec(`DELETE FROM users WHERE username NOT IN (${placeholders})`, keep);
  console.log('Deleted other users');

  // 3. Fix farzad password to '123'
  const hash = await bcrypt.hash('123', 12);
  db.run("UPDATE users SET password_hash = ? WHERE username = 'farzad'", [hash]);
  console.log('Updated farzad password');

  // 4. Fix ali password to '123'
  db.run("UPDATE users SET password_hash = ? WHERE username = 'ali'", [hash]);
  console.log('Updated ali password');

  // 5. Verify
  const result = db.exec("SELECT id, username, password_hash FROM users");
  console.log('Final users:', JSON.stringify(result, null, 2));

  // Save
  const data = db.export();
  fs.writeFileSync('data/goftgoo.db', Buffer.from(data));
  console.log('DB saved');

  db.close();
})();