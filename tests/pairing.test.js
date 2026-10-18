import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../server/sqlite.js';
import worker, { handle } from '../server/worker.js';
import { generateIdentity, randomSecret, hash, encryptTransfer, decryptTransfer, fingerprint } from '../extension/lib/crypto.js';
import { makeInvite, parseInvite, invitationLink } from '../extension/lib/validation.js';
import { landingResponse } from '../server/landing.js';
import { qrDataUrl } from '../extension/lib/qr.js';

test('room invitation links retain pinned owner, accept legacy codes, and reject mismatched hosts',async()=>{
  const code=makeInvite('https://rooms.example',randomSecret(),await fingerprint((await generateIdentity('Owner')).publicKey));
  const link=invitationLink(code);
  assert.equal(new URL(link).search,'');assert.equal(new URL(link).pathname,'/invite');
  assert.deepEqual(parseInvite(link),parseInvite(code));
  assert.throws(()=>parseInvite(link.replace('https://rooms.example/','https://attacker.example/')));
  assert.throws(()=>parseInvite('javascript:alert(1)'));
  assert.match(qrDataUrl(link),/^data:image\/svg\+xml,/);
  const page=landingResponse(new Request(link));assert.equal(page.status,200);
  assert.match(page.headers.get('Content-Security-Policy'),/connect-src 'none'/);
  const html=await page.text();assert.ok(!html.includes(code));
  assert.match(html,/releases\/latest\/download\/quicksend-extension\.zip/);
});

test('device relay: scoped capability, pinned keys, encrypted snapshot, idempotency, expiry and cancellation',async t=>{
  const DB=createDatabase();t.after(()=>DB.close());const env={DB};
  const receiver=await generateIdentity('New browser'),sender=await generateIdentity('Owner'),outsider=await generateIdentity('Wrong browser');
  const id=crypto.randomUUID(),secret=randomSecret();
  async function call(path,method='GET',value,token=secret){const response=await handle(new Request(`https://rooms.example/v1/device-pairings${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(value?{body:JSON.stringify(value)}:{})}),env);return {status:response.status,data:await response.json()};}
  const request={id,secretHash:await hash(secret),publicKey:receiver.publicKey};
  assert.equal((await call('','POST',request)).status,200);
  assert.equal((await call('','POST',{...request,publicKey:outsider.publicKey})).status,409);
  assert.equal((await call(`/${id}`,'GET',null,randomSecret())).status,410);
  assert.equal((await call(`/${id}`,'GET',null,'')).status,401);
  assert.equal((await call(`/${id}`)).data.envelope,null);
  const snapshot={v:1,identity:sender,settings:{server:'https://rooms.example'},roomKeys:{},pins:{}};
  const payload=await encryptTransfer(sender,receiver.publicKey,id,snapshot),approval={senderKey:sender.publicKey,envelope:payload};
  assert.equal((await call(`/${id}`,'POST',approval)).status,200);
  assert.equal((await call(`/${id}`,'POST',approval)).status,200);
  assert.equal((await call(`/${id}`,'POST',{...approval,senderKey:outsider.publicKey})).status,409);
  const result=(await call(`/${id}`)).data;
  assert.deepEqual(await decryptTransfer(receiver,result.senderKey,id,result.envelope),snapshot);
  await assert.rejects(()=>decryptTransfer(outsider,result.senderKey,id,result.envelope));
  await assert.rejects(()=>decryptTransfer(receiver,result.senderKey,crypto.randomUUID(),result.envelope));
  const row=await DB.prepare('SELECT * FROM device_pairings WHERE id=?').bind(id).first();
  assert.ok(!JSON.stringify(row).includes(sender.token));assert.ok(!JSON.stringify(row).includes(sender.privateKey.d));assert.ok(!JSON.stringify(row).includes(secret));
  assert.equal((await call(`/${id}`,'DELETE')).status,200);
  assert.equal((await call(`/${id}`)).status,410);
  const id2=crypto.randomUUID();await call('','POST',{...request,id:id2});
  await DB.prepare('UPDATE device_pairings SET expires_at=0 WHERE id=?').bind(id2).run();
  assert.equal((await call(`/${id2}`)).status,410);
  assert.equal((await call(`/${id2}`,'POST',approval)).status,410);
  await worker.scheduled(null,env);
  assert.equal(await DB.prepare('SELECT * FROM device_pairings WHERE id=?').bind(id2).first(),null);
});

test('concurrent device approvals publish exactly one encrypted snapshot',async t=>{
  const DB=createDatabase();t.after(()=>DB.close());const id=crypto.randomUUID(),secret=randomSecret(),receiver=await generateIdentity('Receiver');
  const senders=await Promise.all([generateIdentity('One'),generateIdentity('Two')]);
  const call=async(path,value)=>handle(new Request(`https://rooms.example/v1/device-pairings${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify(value)}),{DB});
  await call('',{id,secretHash:await hash(secret),publicKey:receiver.publicKey});
  const approvals=await Promise.all(senders.map(async sender=>({senderKey:sender.publicKey,envelope:await encryptTransfer(sender,receiver.publicKey,id,{owner:sender.name})})));
  const responses=await Promise.all(approvals.map(value=>call(`/${id}`,value)));
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
});

test('client pairs a new browser, validates identity before writing, and deletes the relay',async t=>{
  const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const DB=createDatabase(),originalFetch=globalThis.fetch;t.after(()=>{DB.close();globalThis.fetch=originalFetch;delete globalThis.localStorage;});
  globalThis.fetch=(url,options)=>handle(new Request(url,options),{DB});
  const {connect,createRoom,client}=await import('../extension/lib/client.js');
  const {storage}=await import('../extension/lib/storage.js');
  const {startPairing,approveDevice,receiveDevice,restoreSnapshot,cancelPairing,validateSnapshot}=await import('../extension/lib/pairing.js');
  await connect('https://rooms.example','Owner');const room=await createRoom('Same rooms');const owner=await client(),ownerValues=new Map(values);
  await assert.rejects(()=>startPairing(owner.server),/fresh browser/);
  values.clear();const session=await startPairing(owner.server);assert.equal((await startPairing(owner.server)).id,session.id);
  assert.equal(await receiveDevice(session),null);const newBrowserValues=new Map(values);
  values.clear();for(const [key,value] of ownerValues)values.set(key,value);
  await approveDevice(session.code);
  values.clear();for(const [key,value] of newBrowserValues)values.set(key,value);
  const transfer=await receiveDevice(session);assert.equal(transfer.fingerprint,await fingerprint(owner.identity.publicKey));
  const wrong=await generateIdentity('Wrong');
  await assert.rejects(()=>validateSnapshot({...transfer.snapshot,identity:{...owner.identity,publicKey:wrong.publicKey}}));
  await storage.set('composeDraft',{note:'Previous identity draft'});
  await restoreSnapshot(transfer.snapshot);await cancelPairing(session);
  assert.equal(await storage.get('composeDraft'),null);
  assert.equal((await client()).identity.id,owner.identity.id);assert.equal((await storage.get('roomKeys'))[room.id].key,room.key);
  assert.equal((await DB.prepare('SELECT COUNT(*) count FROM device_pairings').first()).count,0);
});
