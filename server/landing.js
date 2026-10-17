// Invitation fragments stay in the browser; this page makes no network requests.
const script = `const code=new URLSearchParams(location.hash.slice(1)).get('invite');
const output=document.getElementById('code');
if(code?.startsWith('qs1.')&&code.length<2000){output.value=code;history.replaceState(null,'','/invite');}
else document.getElementById('status').textContent='This link is incomplete. Ask your friend for a fresh invitation.';
document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(output.value);document.getElementById('status').textContent='Copied. Open QuickSend → Join with an invitation.';}catch{output.select();document.getElementById('status').textContent='Select and copy the code above.';}};`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Join your QuickSend room</title><link rel="stylesheet" href="/invite.css"><main><p>QUICKSEND ↗</p><h1>Your person saved you a seat.</h1><p>Install or open QuickSend, choose “Join with an invitation”, and paste this invitation. Your friend will compare your fingerprint and approve you.</p><label for="code">Private invitation</label><textarea id="code" readonly rows="6"></textarea><button id="copy">Copy invitation</button><p id="status" role="status">Invitations expire after 15 minutes. Share privately.</p><p><a href="https://github.com/Gautam-Chaurasiya-v1/quickSend#load-the-extension-in-chrome-or-brave" rel="noreferrer">Installation instructions</a></p><p>The code grants a join request, not access to room content.</p></main><script src="/invite.js" defer></script></html>`;
const css = `:root{font:17px/1.6 system-ui;color:#263d32;background:#f5f4ec}main{max-width:620px;margin:8vh auto;padding:28px}h1{font-size:42px;line-height:1.1}textarea{box-sizing:border-box;width:100%;padding:12px;border:1px solid #87948b;border-radius:12px;resize:vertical}button{background:#254c3b;color:white;border:0;border-radius:10px;padding:14px 24px;font:inherit;margin-top:16px;cursor:pointer}a{color:#254c3b}label{display:block}`;
export function landingResponse(request) {
  const path=new URL(request.url).pathname;
  const files={'/invite':[html,'text/html'],'/invite.js':[script,'text/javascript'],'/invite.css':[css,'text/css']};
  if(request.method!=='GET'||!files[path])return null;
  const [content,type]=files[path];
  return new Response(content,{headers:{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});
}
