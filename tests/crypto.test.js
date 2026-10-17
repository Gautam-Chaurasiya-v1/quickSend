import test from 'node:test';
import assert from 'node:assert/strict';
import {generateIdentity,randomSecret,encryptMessage,decryptMessage,wrapRoom,unwrapRoom,fingerprint,encryptBackup,decryptBackup} from '../extension/lib/crypto.js';
import {youtubeVideo,backendOrigin,makeInvite,parseInvite,validateContent} from '../extension/lib/validation.js';

test('canonical YouTube links strip tracking and reject other sites and protocols',()=>{
  for(const value of ['https://www.youtube.com/watch?v=gS_nHTWZEJ8&list=test','https://youtu.be/gS_nHTWZEJ8?si=tracking','https://m.youtube.com/shorts/gS_nHTWZEJ8','https://music.youtube.com/watch?v=gS_nHTWZEJ8','https://www.youtube.com/live/gS_nHTWZEJ8'])assert.equal(youtubeVideo(value),'https://youtu.be/gS_nHTWZEJ8');
  for(const value of ['https://youtube.com.evil.com/watch?v=gS_nHTWZEJ8','javascript:alert(1)','http://youtube.com/watch?v=gS_nHTWZEJ8','https://youtube.com/','https://youtu.be/short',null])assert.equal(youtubeVideo(value),null);
  assert.throws(()=>validateContent({url:'https://evil.com',title:'hello',note:''}));
});
test('backend configuration permits TLS or local development only',()=>{
  assert.equal(backendOrigin('https://example.workers.dev/'),'https://example.workers.dev');
  assert.equal(backendOrigin('http://localhost:8787'),'http://localhost:8787');
  for(const value of ['http://example.com','https://user:password@example.com','https://example.com/path','https://example.com?key=secret','file:///tmp'])assert.throws(()=>backendOrigin(value));
});
test('AES-GCM rejects changed ciphertext, room, sender, message ID, and keys',async()=>{
  const key=randomSecret(),room=crypto.randomUUID(),sender=crypto.randomUUID(),id=crypto.randomUUID(),content={url:'https://youtu.be/gS_nHTWZEJ8',title:'A private title',note:'A private note'};
  const envelope=await encryptMessage(key,content,room,sender,id);
  assert.deepEqual(await decryptMessage(key,envelope,room,sender,id),content);
  assert.notEqual(envelope.iv,(await encryptMessage(key,content,room,sender,id)).iv);
  for(const args of [[randomSecret(),envelope,room,sender,id],[key,envelope,crypto.randomUUID(),sender,id],[key,envelope,room,crypto.randomUUID(),id],[key,envelope,room,sender,crypto.randomUUID()]])await assert.rejects(decryptMessage(...args));
  const tampered={...envelope,data:(envelope.data[0]==='A'?'B':'A')+envelope.data.slice(1)};
  await assert.rejects(decryptMessage(key,tampered,room,sender,id));
  assert.ok(!JSON.stringify(envelope).includes(content.note));
});
test('ECDH/HKDF delivers a room key only to the approved peer',async()=>{
  const [alice,bob,mallory]=await Promise.all(['Alice','Bob','Mallory'].map(generateIdentity));
  const room={id:crypto.randomUUID(),name:'Rabbit hole',key:randomSecret()};
  const envelope=await wrapRoom(alice,bob.publicKey,room,bob.id);
  assert.deepEqual(await unwrapRoom(bob,alice.publicKey,envelope,room.id,alice.id),room);
  await assert.rejects(unwrapRoom(mallory,alice.publicKey,envelope,room.id,alice.id));
  await assert.rejects(unwrapRoom(bob,mallory.publicKey,envelope,room.id,alice.id));
  assert.notEqual(await fingerprint(alice.publicKey),await fingerprint(bob.publicKey));
  const invite=makeInvite('https://example.workers.dev',randomSecret(),await fingerprint(alice.publicKey));
  assert.equal(parseInvite(invite).server,'https://example.workers.dev');
  assert.ok(!invite.includes(room.key));assert.throws(()=>parseInvite('broken'));
});
test('encrypted backup restores identity and fails closed on wrong password',async()=>{
  const value={identity:await generateIdentity('Alice'),roomKeys:{key:randomSecret()}};
  const backup=await encryptBackup(value,'a sufficiently long password');
  assert.deepEqual(await decryptBackup(backup,'a sufficiently long password'),value);
  assert.ok(!JSON.stringify(backup).includes(value.identity.token));
  await assert.rejects(decryptBackup(backup,'another long password'));
  await assert.rejects(encryptBackup(value,'short'));
});
