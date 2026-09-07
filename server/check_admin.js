const sql = require('sql.js');
const fs = require('fs');

(async () => {
  const SQL = await sql();
  const db = new SQL.Database(fs.readFileSync('data/goftgoo.db'));
  const r = db.exec("SELECT id, email, username, role FROM admin_users");
  console.log('Admins:', JSON.stringify(r, null, 2));
  db.close();
})();