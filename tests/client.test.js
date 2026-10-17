import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../server/sqlite.js';
import {handle} from '../server/worker.js';
import {storage} from '../extension/lib/storage.js';
import {connect,listRooms,createRoom,inviteRoom,joinRoom,approvePeer,sendVideo,getMessages,flushOutbox} from '../extension/lib/client.js';

test('client persists encrypted outbox across lost acknowledgements, deduplicates retries, and unlocks cached inbox offline',async t=>{
  const DB=createDatabase(),realFetch=globalThis.fetch;let online=true,dropAcknowledgement=false;
  const makeStorage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};};
  const aliceStore=makeStorage(),bobStore=makeStorage();globalThis.localStorage=aliceStore;
  t.after(()=>{DB.close();globalThis.fetch=realFetch;delete globalThis.localStorage;});
  globalThis.fetch=async(url,options)=>{
    if(!online)throw new TypeError('Test network offline');
    const response=await handle(new Request(url,options),{DB,DEV:'true'});
    if(dropAcknowledgement && options.method==='POST' && String(url).endsWith('/messages')){dropAcknowledgement=false;throw new TypeError('Test response lost after commit');}
    return response;
  };
  await connect('http://localhost:8787','Alice');const created=await createRoom('Weekend finds'),invite=await inviteRoom(created.id);
  globalThis.localStorage=bobStore;await connect('http://localhost:8787','Bob');await joinRoom(invite.code);
  globalThis.localStorage=aliceStore;let rooms=await listRooms();await approvePeer(rooms[0]);rooms=await listRooms();
  const content={url:'https://youtu.be/gS_nHTWZEJ8',title:'Encrypted title',note:'Do not store this note as plaintext on the service'};
  dropAcknowledgement=true;assert.equal(await sendVideo(rooms[0],content),false);
  const queued=await storage.get('outbox');assert.equal(queued.length,1);assert.ok(!JSON.stringify(queued).includes(content.note));
  assert.equal((await DB.prepare('SELECT COUNT(*) count FROM messages').first()).count,1);
  await flushOutbox();assert.equal((await storage.get('outbox')).length,0);
  assert.equal((await DB.prepare('SELECT COUNT(*) count FROM messages').first()).count,1);
  globalThis.localStorage=bobStore;rooms=await listRooms();const response=await getMessages(rooms[0]);assert.deepEqual(response.messages[0].content,content);
  online=false;const cachedRooms=await listRooms();assert.equal(cachedRooms[0].offline,true);assert.deepEqual((await getMessages(cachedRooms[0])).messages[0].content,content);
  online=true;await storage.set('pins',{[created.id]:'wrong fingerprint'});assert.match((await listRooms())[0].keyError,/identity changed/i);
});
