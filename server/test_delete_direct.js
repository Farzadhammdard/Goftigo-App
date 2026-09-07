const sql = require('sql.js');
const fs = require('fs');

(async () => {
  const SQL = await sql();
  const db = new SQL.Database(fs.readFileSync('data/goftgoo.db'));
  
  const userId = 'GFT-2D2F234B';
  
  // Check if user exists
  const user = db.exec("SELECT * FROM users WHERE id = '" + userId + "'");
  console.log('User exists:', user[0]?.values.length > 0);
  if (user[0]?.values[0]) {
    console.log('User status:', user[0].values[0][6]); // status column
  }
  
  // Try the update
  try {
    db.run("UPDATE users SET status = 'deleted', is_online = 0, updated_at = ? WHERE id = ?", [Date.now(), userId]);
    console.log('UPDATE success');
  } catch (e) {
    console.log('UPDATE error:', e.message);
  }
  
  // Try delete refresh_tokens
  try {
    db.run("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);
    console.log('DELETE refresh_tokens success');
  } catch (e) {
    console.log('DELETE refresh_tokens error:', e.message);
  }
  
  // Check final status
  const after = db.exec("SELECT id, status, is_online FROM users WHERE id = '" + userId + "'");
  console.log('After:', JSON.stringify(after));
  
  db.close();
})();