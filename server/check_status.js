const sql = require('sql.js');
const fs = require('fs');

(async () => {
  const SQL = await sql();
  const db = new SQL.Database(fs.readFileSync('data/goftgoo.db'));
  
  const r = db.exec("SELECT id, username, status, password_hash FROM users WHERE username='farzad'");
  console.log('farzad:', JSON.stringify(r));
  
  const r2 = db.exec("SELECT id, username, status, password_hash FROM users WHERE username='ali'");
  console.log('ali:', JSON.stringify(r2));
  
  db.close();
})();