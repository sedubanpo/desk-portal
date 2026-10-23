const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),http=require('http'),assert=require('assert/strict');
(async()=>{
const source=fs.readFileSync(process.cwd()+'/docs/hub-start.mjs','utf8');let pending=[];
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.mjs')?'text/javascript':'text/html');
if(req.url==='/slow-image'){pending.push(res);return;}
if(req.url==='/hub-start.mjs')return res.end(source);
if(req.url==='/hub-client.mjs')return res.end('export function installSso(){parent.postMessage("started","*");}');
if(req.url==='/child')return res.end('<img src="/slow-image"><script type="module" src="/hub-start.mjs"></script>');
res.end('<script>window.started=false;addEventListener("message",e=>{if(e.data==="started")window.started=true;});</script><iframe hidden src="/child"></iframe>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{const p=await b.newPage();await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.started,{},{timeout:2000});console.log('PASS SSO starts in hidden iframe while image load is pending');}finally{await b.close();pending.forEach(r=>r.end());server.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
