/** Explicit target; uses only disposable ephemeral keys and deletes its relay. */
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { backendOrigin } from '../extension/lib/validation.js';
import { generateIdentity,randomSecret,hash,encryptTransfer,decryptTransfer } from '../extension/lib/crypto.js';
if(!process.argv[2])throw new Error('Pass an explicit API origin.');
const server=backendOrigin(process.argv[2]),id=crypto.randomUUID(),secret=randomSecret(),checks=[];
const receiver=await generateIdentity('Disposable pairing receiver'),sender=await generateIdentity('Disposable pairing sender');
async function call(path,method='GET',value,capability=secret){const response=await fetch(`${server}/v1/device-pairings${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${capability}`},...(value?{body:JSON.stringify(value)}:{}),signal:AbortSignal.timeout(20000),redirect:'error'});return {status:response.status,data:await response.json()};}
function passed(name){checks.push(name);console.log(`PASS ${name}`);}
try {
  const page=await fetch(`${server}/invite`,{signal:AbortSignal.timeout(20000)});assert.equal(page.status,200);assert.match(page.headers.get('Content-Security-Policy'),/connect-src 'none'/);passed('live isolated invitation page');
  const started=await call('','POST',{id,secretHash:await hash(secret),publicKey:receiver.publicKey});assert.equal(started.status,200);assert.ok(started.data.expiresAt>Date.now());passed('ten-minute relay creation');
  assert.equal((await call(`/${id}`,'GET',null,randomSecret())).status,410);passed('wrong capability rejected');
  const snapshot={v:1,identity:sender,settings:{server},roomKeys:{},pins:{}};
  const approval={senderKey:sender.publicKey,envelope:await encryptTransfer(sender,receiver.publicKey,id,snapshot)};
  assert.equal((await call(`/${id}`,'POST',approval)).status,200);passed('encrypted snapshot publication');
  assert.equal((await call(`/${id}`,'POST',approval)).status,200);passed('idempotent approval retry');
  assert.equal((await call(`/${id}`,'POST',{...approval,senderKey:receiver.publicKey})).status,409);passed('conflicting approval rejected');
  const result=(await call(`/${id}`)).data;assert.deepEqual(await decryptTransfer(receiver,result.senderKey,id,result.envelope),snapshot);passed('snapshot decryption in receiver');
  assert.equal((await call(`/${id}`,'DELETE')).status,200);assert.equal((await call(`/${id}`)).status,410);passed('relay deleted and subsequent access denied');
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/live-pairing-smoke-report.json',JSON.stringify({server,checkedAt:new Date().toISOString(),checks},null,2)+'\n');
  console.log(`Completed ${checks.length} live pairing checks. No identities registered or credentials persisted.`);
} finally {await call(`/${id}`,'DELETE').catch(()=>{});}
