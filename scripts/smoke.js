/** Explicit remote smoke test: creates three disposable QA identities and closes its test room. */
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {backendOrigin} from '../extension/lib/validation.js';
import {generateIdentity,hash,randomSecret,wrapRoom,unwrapRoom,encryptMessage,decryptMessage} from '../extension/lib/crypto.js';
const server=backendOrigin(process.argv[2]||'http://localhost:8787');
const checks=[],identities=[];let roomId;
async function call(path,user,method='GET',body,origin){
  const response=await fetch(server+'/v1'+path,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${user.token}`}:{ }),...(origin?{Origin:origin}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();return {status:response.status,data};
}
function passed(name){checks.push(name);console.log(`PASS ${name}`);}
async function identity(name){const value=await generateIdentity(name);assert.equal((await call('/identities',null,'POST',{id:value.id,name,publicKey:value.publicKey,tokenHash:await hash(value.token)})).status,200);identities.push(value);return value;}
try{
  assert.equal((await call('/health')).status,200);passed('live health endpoint');
  assert.equal((await call('/rooms')).status,401);passed('unauthenticated requests rejected');
  const owner=await identity('Release QA owner'),peer=await identity('Release QA peer'),outsider=await identity('Release QA outsider');passed('device registration');
  assert.equal((await call('/rooms',owner,'GET',undefined,'https://untrusted.example')).status,403);passed('foreign website origin rejected');
  const room={id:crypto.randomUUID(),name:'Disposable live release check',key:randomSecret()};roomId=room.id;
  assert.equal((await call('/rooms',owner,'POST',{id:room.id})).status,200);
  const token=randomSecret();assert.equal((await call(`/rooms/${room.id}/invites`,owner,'POST',{tokenHash:await hash(token)})).status,200);
  assert.equal((await call('/join',peer,'POST',{token})).status,200);
  assert.equal((await call('/join',outsider,'POST',{token})).status,410);passed('invitation single use');
  assert.equal((await call(`/rooms/${room.id}/messages`,peer)).status,404);passed('pending member cannot read');
  assert.equal((await call(`/rooms/${room.id}/approve`,owner,'POST',{userId:peer.id,envelope:await wrapRoom(owner,peer.publicKey,room,peer.id)})).status,200);
  const peerRoom=(await call('/rooms',peer)).data.rooms.find(value=>value.id===room.id);
  const unlocked=await unwrapRoom(peer,owner.publicKey,peerRoom.envelope,room.id,owner.id);assert.equal(unlocked.key,room.key);passed('approved peer unlocks key envelope');
  const content={url:'https://youtu.be/gS_nHTWZEJ8',title:'QuickSend live release check',note:'Disposable QA note'},id=crypto.randomUUID();
  const payload={id,envelope:await encryptMessage(room.key,content,room.id,owner.id,id)};
  assert.equal((await call(`/rooms/${room.id}/messages`,owner,'POST',payload)).status,200);
  assert.equal((await call(`/rooms/${room.id}/messages`,owner,'POST',payload)).status,200);
  const incoming=(await call(`/rooms/${room.id}/messages`,peer)).data.messages;assert.equal(incoming.length,1);assert.deepEqual(await decryptMessage(unlocked.key,incoming[0].envelope,room.id,owner.id,id),content);passed('encrypted delivery and idempotent retry');
  assert.equal((await call(`/rooms/${room.id}/messages`,outsider)).status,404);passed('outsider cannot read room');
  assert.equal((await call('/rooms',peer)).data.rooms[0].unread,1);
  await call(`/rooms/${room.id}/read`,peer,'POST',{seq:incoming[0].seq});assert.equal((await call('/rooms',peer)).data.rooms[0].unread,0);passed('unread and read acknowledgement');
  const replyId=crypto.randomUUID();const reply={...content,note:'Return-direction QA note'};
  assert.equal((await call(`/rooms/${room.id}/messages`,peer,'POST',{id:replyId,envelope:await encryptMessage(unlocked.key,reply,room.id,peer.id,replyId)})).status,200);
  const replyPage=(await call(`/rooms/${room.id}/messages`,owner)).data.messages;assert.equal(replyPage.length,2);assert.deepEqual(await decryptMessage(room.key,replyPage[1].envelope,room.id,peer.id,replyId),reply);passed('return-direction encrypted delivery');
  assert.equal((await call(`/rooms/${room.id}/leave`,peer,'POST',{})).status,200);assert.equal((await call(`/rooms/${room.id}/messages`,owner)).status,404);passed('room closure revokes access');roomId=null;
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/live-smoke-report.json',JSON.stringify({server,checkedAt:new Date().toISOString(),checks,disposableIdentityIds:identities.map(value=>value.id)},null,2)+'\n');
  console.log(`Completed ${checks.length} live checks. No credentials were written to the report.`);
}catch(error){console.error(`FAIL ${error.message}`);process.exitCode=1;}
finally{if(roomId&&identities[0])await call(`/rooms/${roomId}/leave`,identities[0],'POST',{}).catch(()=>{});}
