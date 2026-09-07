const sql = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');

(async () => {
  const SQL = await sql();
  const db = new SQL.Database(fs.readFileSync('data/goftgoo.db'));
  
  // Check farzad
  const r = db.exec("SELECT id, username, password_hash FROM users WHERE username='farzad'");
  console.log('farzad in DB:', JSON.stringify(r));
  
  // Test bcrypt
  if (r[0]?.values[0]) {
    const hash = r[0].values[0][2];
    const match = await bcrypt.compare('123', hash);
    console.log('bcrypt compare 123:', match);
  }
  
  db.close();
})();