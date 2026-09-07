const sql = require('sql.js');
const fs = require('fs');

(async () => {
  const SQL = await sql();
  const db = new SQL.Database(fs.readFileSync('data/goftgoo.db'));
  
  const tables = ['message_reactions', 'conversation_participants', 'messages', 'posts', 'friendships', 'follows', 'notifications', 'user_devices', 'post_saves', 'post_likes', 'reports', 'blocked_users', 'group_members', 'refresh_tokens', 'otp_codes'];
  
  for (const t of tables) {
    try {
      const cols = db.exec("PRAGMA table_info(" + t + ")");
      if (cols[0]) {
        const colNames = cols[0].values.map(v => v[1]).join(', ');
        console.log(t + ': ' + colNames);
      }
    } catch (e) {
      console.log(t + ': ERROR - ' + e.message);
    }
  }
  
  db.close();
})();