const http = require('http');

async function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({email: 'admin@goftgoo.com', password: 'admin123'});
    const req = http.request({ 
      hostname: 'localhost', 
      port: 3001, 
      path: '/api/admin/auth/login', 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } 
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function deleteUser(token, userId) {
  return new Promise((resolve, reject) => {
    const req = http.request({ 
      hostname: 'localhost', 
      port: 3001, 
      path: `/api/admin/users/${userId}`, 
      method: 'DELETE', 
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      } 
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({status: res.statusCode, data: JSON.parse(buf)}));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('Logging in...');
  const loginResult = await login();
  console.log('Login:', JSON.stringify(loginResult, null, 2));
  
  if (loginResult.success) {
    const token = loginResult.data.accessToken;
    console.log('Deleting farzad...');
    const userId = 'GFT-2D2F234B'; // farzad
    const delResult = await deleteUser(token, userId);
    console.log('Delete result:', JSON.stringify(delResult, null, 2));
  }
})();