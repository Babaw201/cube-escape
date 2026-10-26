const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function gameResponse(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/cube-escape(?=\/)/, '').replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return {status: 404, body: 'Not found'};
  const extension = path.extname(file);
  const contentType = {'.html':'text/html', '.js':'text/javascript', '.svg':'image/svg+xml', '.glb':'model/gltf-binary'}[extension] || 'application/octet-stream';
  let body = fs.readFileSync(file);
  if (relative === 'index.html') body = body.toString('utf8').replace(/loop\(\);\r?\n\}\)\(\);/, 'window.gameEval = code => eval(code); loop();\n})();');
  return {status: 200, contentType, body};
}
module.exports = {gameResponse};
