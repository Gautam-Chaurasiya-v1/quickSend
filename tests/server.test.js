import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../server/sqlite.js';
import worker,{handle} from '../server/worker.js';
import {generateIdentity,hash,randomSecret,encryptMessage,decryptMessage,wrapRoom,unwrapRoom} from '../extension/lib/crypto.js';

async function setup(t){const DB=createDatabase();t.after(()=>DB.close());const env={DB,DEV:'true'};
  async function call(path,user,method='GET',body,extra={}){const response=await handle(new Request(`http://localhost:8787/v1${path}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${user.token}`}:{ }),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);return {status:response.status,data:await response.json()};}
  async function identity(name){const user=await generateIdentity(name);assert.equal((await call('/identities',null,'POST',{id:user.id,name:user.name,tokenHash:await hash(user.token),publicKey:user.publicKey})).status,200);return user;}
  const alice=await identity('Alice'),bob=await identity('Bob'),mallory=await identity('Mallory');
  const room={id:crypto.randomUUID(),name:'The rabbit hole',key:randomSecret()};
  assert.equal((await call('/rooms',alice,'POST',{id:room.id})).status,200);
  async function invite(){const token=randomSecret();assert.equal((await call(`/rooms/${room.id}/invites`,alice,'POST',{tokenHash:await hash(token)})).status,200);return token;}
  return {DB,env,call,alice,bob,mallory,room,invite};
}
test('two devices pair, exchange encrypted videos, track unread, paginate and deduplicate',async t=>{
  const {DB,call,alice,bob,mallory,room,invite}=await setup(t);const token=await invite();
  assert.equal((await call('/join',bob,'POST',{token})).status,200);
  assert.equal((await call(`/rooms/${room.id}/messages`,bob)).status,404);
  assert.equal((await call(`/rooms/${room.id}/approve`,bob,'POST',{userId:bob.id,envelope:{}})).status,404);
  const wrapped=await wrapRoom(alice,bob.publicKey,room,bob.id);
  assert.equal((await call(`/rooms/${room.id}/approve`,alice,'POST',{userId:bob.id,envelope:wrapped})).status,200);
  const bobRooms=(await call('/rooms',bob)).data.rooms;assert.equal(bobRooms[0].status,'active');
  const unlocked=await unwrapRoom(bob,alice.publicKey,bobRooms[0].envelope,room.id,alice.id);assert.equal(unlocked.key,room.key);
  const id=crypto.randomUUID(),content={url:'https://youtu.be/gS_nHTWZEJ8',title:'Private title',note:'Secret note'};
  const envelope=await encryptMessage(room.key,content,room.id,alice.id,id),payload={id,envelope};
  assert.equal((await call(`/rooms/${room.id}/messages`,alice,'POST',payload)).status,200);
  assert.equal((await call(`/rooms/${room.id}/messages`,alice,'POST',payload)).status,200);
  assert.equal((await call(`/rooms/${room.id}/messages`,mallory)).status,404);
  assert.equal((await call(`/rooms/${room.id}/messages`,mallory,'POST',payload)).status,404);
  const received=(await call(`/rooms/${room.id}/messages`,bob)).data.messages;assert.equal(received.length,1);
  assert.deepEqual(await decryptMessage(unlocked.key,received[0].envelope,room.id,alice.id,id),content);
  const stored=await DB.prepare('SELECT envelope FROM messages WHERE id=?').bind(id).first();assert.ok(!stored.envelope.includes('Private title'));assert.ok(!stored.envelope.includes('Secret note'));
  assert.equal((await call('/rooms',bob)).data.rooms[0].unread,1);
  assert.equal((await call('/rooms',alice)).data.rooms[0].unread,0);
  await call(`/rooms/${room.id}/read`,bob,'POST',{seq:received[0].seq});assert.equal((await call('/rooms',bob)).data.rooms[0].unread,0);
  assert.equal((await call(`/rooms/${room.id}/messages?before=${received[0].seq}`,bob)).data.messages.length,0);
  const changed={...payload,envelope:await encryptMessage(room.key,{...content,note:'changed'},room.id,alice.id,id)};
  assert.equal((await call(`/rooms/${room.id}/messages`,alice,'POST',changed)).status,409);
  assert.equal((await call(`/rooms/${room.id}/invites`,alice,'POST',{tokenHash:await hash(randomSecret())})).status,409);
});
test('single-use and expired invitations, pending cancellation and rejection',async t=>{
  const {DB,call,alice,bob,mallory,room,invite}=await setup(t);const first=await invite();
  await DB.prepare('UPDATE invites SET expires_at=0').run();assert.equal((await call('/join',bob,'POST',{token:first})).status,410);
  const second=await invite();assert.equal((await call('/join',bob,'POST',{token:second})).status,200);
  assert.equal((await call('/join',mallory,'POST',{token:second})).status,410);
  await call(`/rooms/${room.id}/leave`,bob,'POST',{});assert.equal((await call('/rooms',alice)).data.rooms.length,1);
  const third=await invite();await call('/join',mallory,'POST',{token:third});
  assert.equal((await call(`/rooms/${room.id}/reject`,bob,'POST',{userId:mallory.id})).status,404);
  await call(`/rooms/${room.id}/reject`,alice,'POST',{userId:mallory.id});
  assert.equal((await call('/rooms',mallory)).data.rooms.length,0);
  // A rejected request must not be able to rejoin with its consumed code.
  assert.equal((await call('/join',mallory,'POST',{token:third})).status,410);
});
test('untrusted origins, missing auth, invalid keys and plaintext payloads are rejected',async t=>{
  const {call,alice,room}=await setup(t);
  assert.equal((await call('/rooms',null)).status,401);
  assert.equal((await call('/rooms',alice,'GET',undefined,{Origin:'https://evil.example'})).status,403);
  assert.equal((await call('/rooms',alice,'GET',undefined,{Origin:'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'})).status,200);
  assert.equal((await call(`/rooms/${room.id}/messages`,alice,'POST',{id:crypto.randomUUID(),envelope:{text:'plain'}})).status,409);
  const bad=await generateIdentity('bad');assert.equal((await call('/identities',null,'POST',{id:bad.id,name:'bad',tokenHash:await hash(bad.token),publicKey:{...bad.publicKey,d:'private-key'}})).status,400);
  assert.equal((await call('/rooms',alice,'POST',{id:"';DROP TABLE rooms;--"})).status,400);
});
test('closing a paired room revokes access, removes ciphertext and never reuses its key',async t=>{
  const {call,alice,bob,room,invite}=await setup(t);await call('/join',bob,'POST',{token:await invite()});
  await call(`/rooms/${room.id}/approve`,alice,'POST',{userId:bob.id,envelope:await wrapRoom(alice,bob.publicKey,room,bob.id)});
  const id=crypto.randomUUID();await call(`/rooms/${room.id}/messages`,alice,'POST',{id,envelope:await encryptMessage(room.key,{url:'https://youtu.be/gS_nHTWZEJ8',title:'a',note:''},room.id,alice.id,id)});
  assert.equal((await call(`/rooms/${room.id}/leave`,bob,'POST',{})).status,200);
  assert.equal((await call('/rooms',alice)).data.rooms.length,0);
  assert.equal((await call(`/rooms/${room.id}/messages`,alice)).status,404);
});
test('scheduled retention deletes 90-day messages and expired invitations',async t=>{
  const {DB,env,room,alice}=await setup(t);
  await DB.prepare('INSERT INTO messages(id,room_id,sender_id,envelope,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),room.id,alice.id,'{}',0).run();
  await worker.scheduled({},env);
  assert.equal((await DB.prepare('SELECT COUNT(*) count FROM messages').first()).count,0);
});

test('message pages are bounded, unread queries are capped, and paired rooms reject plaintext',async t=>{
  const {DB,call,alice,bob,room,invite}=await setup(t);await call('/join',bob,'POST',{token:await invite()});
  await call(`/rooms/${room.id}/approve`,alice,'POST',{userId:bob.id,envelope:await wrapRoom(alice,bob.publicKey,room,bob.id)});
  assert.equal((await call(`/rooms/${room.id}/messages`,alice,'POST',{id:crypto.randomUUID(),envelope:{text:'plaintext'}})).status,400);
  const envelope=await encryptMessage(room.key,{url:'https://youtu.be/gS_nHTWZEJ8',title:'a',note:''},room.id,alice.id,crypto.randomUUID());
  for(let index=0;index<105;index++)await DB.prepare('INSERT INTO messages(id,room_id,sender_id,envelope,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),room.id,alice.id,JSON.stringify(envelope),Date.now()).run();
  const page=(await call(`/rooms/${room.id}/messages`,bob)).data;assert.equal(page.messages.length,40);assert.equal(page.hasMore,true);
  const next=(await call(`/rooms/${room.id}/messages?before=${page.messages[0].seq}`,bob)).data;assert.equal(next.messages.length,40);assert.ok(next.messages.at(-1).seq<page.messages[0].seq);
  assert.equal((await call('/rooms',bob)).data.rooms[0].unread,100);
});

test('concurrent claims cannot admit two people through one invitation',async t=>{
  const {DB,call,bob,mallory,room,invite}=await setup(t);const token=await invite();
  const results=await Promise.all([call('/join',bob,'POST',{token}),call('/join',mallory,'POST',{token})]);
  assert.equal(results.filter(value=>value.status===200).length,1);
  assert.ok([409,410].includes(results.find(value=>value.status!==200).status));
  assert.equal((await DB.prepare('SELECT COUNT(*) count FROM members WHERE room_id=?').bind(room.id).first()).count,2);
});
