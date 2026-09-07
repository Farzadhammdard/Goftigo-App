const sql = require('sql.js');
const fs = require('fs');

(async () => {
  const SQL = await sql();
  const db = new SQL.Database(fs.readFileSync('data/goftgoo.db'));
  
  const userId = 'GFT-2D2F234B';
  
  const conv = db.exec("SELECT COUNT(*) as c FROM conversation_participants WHERE user_id = '" + userId + "'");
  const msg = db.exec("SELECT COUNT(*) as c FROM messages WHERE sender_id = '" + userId + "'");
  const posts = db.exec("SELECT COUNT(*) as c FROM posts WHERE author_id = '" + userId + "'");
  const friends = db.exec("SELECT COUNT(*) as c FROM friendships WHERE user_id = '" + userId + "' OR friend_id = '" + userId + "'");
  const follows = db.exec("SELECT COUNT(*) as c FROM follows WHERE follower_id = '" + userId + "' OR following_id = '" + userId + "'");
  const notifs = db.exec("SELECT COUNT(*) as c FROM notifications WHERE user_id = '" + userId + "'");
  const devices = db.exec("SELECT COUNT(*) as c FROM user_devices WHERE user_id = '" + userId + "'");
  const reactions = db.exec("SELECT COUNT(*) as c FROM message_reactions WHERE user_id = '" + userId + "'");
  const saves = db.exec("SELECT COUNT(*) as c FROM post_saves WHERE user_id = '" + userId + "'");
  const likes = db.exec("SELECT COUNT(*) as c FROM post_likes WHERE user_id = '" + userId + "'");
  const reports = db.exec("SELECT COUNT(*) as c FROM reports WHERE reporter_id = '" + userId + "'");
  const blocked = db.exec("SELECT COUNT(*) as c FROM blocked_users WHERE blocker_id = '" + userId + "' OR blocked_id = '" + userId + "'");
  const groups = db.exec("SELECT COUNT(*) as c FROM group_members WHERE user_id = '" + userId + "'");
  const refresh = db.exec("SELECT COUNT(*) as c FROM refresh_tokens WHERE user_id = '" + userId + "'");
  const otp = db.exec("SELECT COUNT(*) as c FROM otp_codes WHERE phone_number = (SELECT phone_number FROM users WHERE id = '" + userId + "')");
  
  console.log('conversation_participants:', conv[0].values[0][0]);
  console.log('messages:', msg[0].values[0][0]);
  console.log('posts:', posts[0].values[0][0]);
  console.log('friendships:', friends[0].values[0][0]);
  console.log('follows:', follows[0].values[0][0]);
  console.log('notifications:', notifs[0].values[0][0]);
  console.log('user_devices:', devices[0].values[0][0]);
  console.log('message_reactions:', reactions[0].values[0][0]);
  console.log('post_saves:', saves[0].values[0][0]);
  console.log('post_likes:', likes[0].values[0][0]);
  console.log('reports:', reports[0].values[0][0]);
  console.log('blocked_users:', blocked[0].values[0][0]);
  console.log('group_members:', groups[0].values[0][0]);
  console.log('refresh_tokens:', refresh[0].values[0][0]);
  console.log('otp_codes:', otp[0].values[0][0]);
  
  db.close();
})();