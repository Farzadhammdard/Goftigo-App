const sql = require('sql.js');
const fs = require('fs');

(async () => {
  const SQL = await sql();
  const db = new SQL.Database(fs.readFileSync('data/goftgoo.db'));
  
  db.run("UPDATE users SET status = 'active' WHERE username = 'farzad'");
  
  const r = db.exec("SELECT id, username, status FROM users WHERE username='farzad'");
  console.log('Fixed farzad:', JSON.stringify(r));
  
  const data = db.export();
  fs.writeFileSync('data/goftgoo.db', Buffer.from(data));
  console.log('DB saved');
  
  db.close();
})();