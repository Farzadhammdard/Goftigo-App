const sql = require('sql.js');
const fs = require('fs');
sql().then(DB => {
  const db = new DB.Database(fs.readFileSync('data/goftgoo.db'));
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables:', JSON.stringify(tables));
  if (tables[0]) {
    console.log('Table list:', tables[0].values.map(r => r[0]).join(', '));
  }
  const users = db.exec("SELECT id, username, phone_number, password_hash FROM users LIMIT 10");
  console.log('Users:', JSON.stringify(users));
  db.close();
});
