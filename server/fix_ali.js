const sql = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');

(async () => {
  const SQL = await sql();
  const dbBuf = fs.readFileSync('data/goftgoo.db');
  const db = new SQL.Database(dbBuf);
  
  // Hash new password for ali
  const hash = await bcrypt.hash('123', 12);
  console.log('New hash:', hash);
  
  // Update ali's password
  db.run("UPDATE users SET password_hash = ? WHERE username = 'ali'", [hash]);
  
  // Verify
  const result = db.exec("SELECT username, password_hash FROM users WHERE username = 'ali'");
  console.log('Updated ali:', JSON.stringify(result));
  
  // Save
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync('data/goftgoo.db', buffer);
  console.log('DB saved');
  
  db.close();
})();
