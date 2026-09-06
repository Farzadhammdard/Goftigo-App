const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ hostname: 'localhost', port: 3001, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log('Login farzad...');
  const r1 = await post('/api/auth/login', { username: 'farzad', password: '123' });
  console.log(JSON.stringify(r1, null, 2));
  console.log('Login ali...');
  const r2 = await post('/api/auth/login', { username: 'ali', password: '123' });
  console.log(JSON.stringify(r2, null, 2));
})();
