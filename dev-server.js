const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const DIST = path.join(__dirname, 'dist');

// Start esbuild watcher in background
require('child_process').spawn('npx', ['esbuild', 'src/main.ts', '--bundle', '--outfile=dist/app.min.js', '--sourcemap', '--watch'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
});

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Try exact file first
  let filePath = path.join(__dirname, urlPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serve(filePath, res);
    return;
  }

  // SPA fallback: serve index.html
  serve(path.join(__dirname, 'index.html'), res);
}).listen(PORT, () => {
  console.log(`Dev server: http://localhost:${PORT}`);
});

function serve(filePath, res) {
  const ext = path.extname(filePath);
  const type = MIME[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': type });
  res.end(content);
}
