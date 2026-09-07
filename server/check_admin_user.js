const sql = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');

(async () => {
  const SQL = await sql();
  const db = new SQL.Database(fs.readFileSync('data/goftgoo.db'));
  
  const r = db.exec("SELECT id, email, username, password_hash, is_active, role FROM admin_users");
  console.log('Admin user:', JSON.stringify(r, null, 2));
  
  if (r[0]?.values[0]) {
    const hash = r[0].values[0][3];
    console.log('Testing bcrypt compare...');
    const match = await bcrypt.compare('admin123', hash);
    console.log('Match:', match);
  }
  
  db.close();
})();