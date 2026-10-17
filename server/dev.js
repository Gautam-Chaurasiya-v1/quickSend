import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import { createDatabase } from './sqlite.js';
import { landingResponse } from './landing.js';
import { handle } from './worker.js';
mkdirSync(new URL('../.data',import.meta.url),{recursive:true});
const DB = createDatabase(fileURLToPath(new URL('../.data/quicksend.sqlite',import.meta.url)));
const root = resolve(fileURLToPath(new URL('../extension/',import.meta.url)));
const mime = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json' };
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost:8787');
    const landing=landingResponse(new Request(url));
    if(landing){res.writeHead(landing.status,Object.fromEntries(landing.headers));res.end(await landing.text());return;}
    if (url.pathname.startsWith('/v1/')) {
      let bytes = 0; const chunks=[];
      for await (const chunk of req) { bytes+=chunk.length; if(bytes>(url.pathname.startsWith('/v1/device-pairings')?100000:16384)) { res.writeHead(413);res.end();return; } chunks.push(chunk); }
      const request = new Request(url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
      const response = await handle(request,{DB,DEV:'true'}); res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } else {
      const file = resolve(root,'.'+decodeURIComponent(url.pathname === '/' ? '/app.html' : url.pathname));
      if(!file.startsWith(root+sep) && file!==root) {res.writeHead(403);res.end();return;}
      const content=await readFile(file);
      const ext='.'+file.split('.').at(-1);
      res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' http://localhost:8787 http://127.0.0.1:8787; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}); res.end(content);
    }
  } catch {res.writeHead(404);res.end('Not found');}
});
const port=Number(process.env.QUICKSEND_PORT||8787);
server.listen(port,'127.0.0.1',()=>console.log(`QuickSend local development: http://localhost:${port}`));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{DB.close();process.exit(0);}));
