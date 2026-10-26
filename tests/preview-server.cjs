const http=require('node:http');
const {gameResponse}=require('./serve-game.cjs');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const response=gameResponse(pathname==='/robot-preview'?'index.html':pathname);
  if(pathname==='/robot-preview')response.body=response.body.toString().replace('</body>','<script src="tests/robot-preview.js"></script></body>');
  res.writeHead(response.status,{'Content-Type':response.contentType||'text/plain'});res.end(response.body);
});
server.listen(8765,'127.0.0.1',()=>console.log('Robot preview: http://127.0.0.1:8765/robot-preview'));
