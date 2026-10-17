import { Api } from './api.js';
import { storage, saveRoom, update } from './storage.js';
import { generateIdentity, hash, randomSecret, fingerprint, wrapRoom, unwrapRoom, encryptMessage, decryptMessage } from './crypto.js';
import { backendOrigin, displayName, parseInvite, makeInvite, validateContent } from './validation.js';

export async function connect(server, name) {
  server = backendOrigin(server); name = displayName(name);
  // Persist before registration: a network failure must not strand a new identity.
  let identity = await storage.get('identity');
  if (!identity) { identity = await generateIdentity(name); await storage.set('identity',identity); }
  const saved = await storage.get('settings');
  if(saved?.server && saved.server!==server) throw new Error('This identity belongs to another server. Use another browser profile for a different server.');
  const api = new Api(server,identity);
  await api.request('/identities',{method:'POST',body:{id:identity.id,name:identity.name,tokenHash:await hash(identity.token),publicKey:identity.publicKey}});
  await storage.set('settings',{server});
  return identity;
}
export async function client() {
  const [settings,identity]=await Promise.all([storage.get('settings'),storage.get('identity')]);
  if (!settings?.server || !identity) return null;
  return {api:new Api(settings.server,identity),identity,server:settings.server};
}
export async function listRooms() {
  const context=await client(); if(!context) return [];
  let rooms,offline=false;
  try { const response=await context.api.request('/rooms');rooms=response.rooms;await storage.set('cachedRooms',rooms); }
  catch(error) {if(error.status!==0)throw error;rooms=await storage.get('cachedRooms');if(!rooms)throw error;offline=true;}

  let keys=await storage.get('roomKeys') || {};
  const pins=await storage.get('pins') || {};
  for(const room of rooms) {
    room.offline=offline;
    room.name=keys[room.id]?.name || 'Unverified room';
    const owner=room.members.find(m=>m.id===room.owner_id);
    if(room.owner_id!==context.identity.id) {
      if(!pins[room.id] || pins[room.id]!==await fingerprint(owner.publicKey)) {room.keyError='Owner identity changed or is not verified. Stop and check with your friend.';continue;}
      if(room.status==='active' && !keys[room.id] && room.envelope) {
        try { const value=await unwrapRoom(context.identity,owner.publicKey,room.envelope,room.id,owner.id); await saveRoom(value); keys={...keys,[room.id]:value}; }
        catch {room.keyError='Cannot unlock this room. Restore the latest backup or create a new room.';}
      }
    }
    room.local=keys[room.id];
    room.name=room.local?.name || (room.status==='pending' ? `Waiting for ${owner.name}` : 'Room key unavailable');
    room.peer=room.members.find(m=>m.id!==context.identity.id);
    if(room.peer?.status==='active' && room.local?.peerFingerprint && room.local.peerFingerprint!==await fingerprint(room.peer.publicKey)) room.keyError='Member identity changed. Sharing is blocked.';
    if(room.owner_id===context.identity.id && room.peer?.status==='active' && !room.local?.peerFingerprint) room.keyError='Member identity is not pinned on this device. Restore a newer backup.';
  }
  return rooms;
}
export async function createRoom(name) {
  const ctx=await client(); const room={id:crypto.randomUUID(),name:displayName(name,60),key:randomSecret()};
  await saveRoom(room);
  await ctx.api.request('/rooms',{method:'POST',body:{id:room.id}});
  return room;
}
export async function inviteRoom(roomId) {
  const ctx=await client(), token=randomSecret();
  const {expiresAt}=await ctx.api.request(`/rooms/${roomId}/invites`,{method:'POST',body:{tokenHash:await hash(token)}});
  return {code:makeInvite(ctx.server,token,await fingerprint(ctx.identity.publicKey)),expiresAt};
}
export async function joinRoom(raw) {
  const invite=parseInvite(raw),ctx=await client();
  if(invite.server!==ctx.server) throw new Error('This invite belongs to a different server. Both people must connect to the same server.');
  const response=await ctx.api.request('/join',{method:'POST',body:{token:invite.token}});
  if(await fingerprint(response.owner.publicKey)!==invite.ownerFingerprint) throw new Error('Invitation owner identity does not match. Do not approve this connection.');
  await update('pins',value=>({...value,[response.roomId]:invite.ownerFingerprint}));
  return response;
}
export async function approvePeer(room) {
  const ctx=await client();
  if(!room.local || !room.peer || room.peer.status!=='pending') throw new Error('This request is no longer available.');
  const envelope=await wrapRoom(ctx.identity,room.peer.publicKey,room.local,room.peer.id);
  // Pin the exact approved key before the request can succeed.
  await saveRoom({...room.local,peerFingerprint:await fingerprint(room.peer.publicKey)});
  await ctx.api.request(`/rooms/${room.id}/approve`,{method:'POST',body:{userId:room.peer.id,envelope}});
}
export async function getMessages(room, before) {
  if(!room.local || room.keyError) throw new Error(room.keyError || 'Room key unavailable. Restore your backup.');
  const ctx=await client();
  let response;
  if(room.offline){response=(await storage.get('cachedMessages')||{})[room.id]||{messages:[],hasMore:false};response={...response,hasMore:false};}
  else {response=await ctx.api.request(`/rooms/${room.id}/messages${before?`?before=${before}`:''}`);if(!before)await update('cachedMessages',value=>({...value,[room.id]:response}));}

  const messages=[];
  for(const entry of response.messages) {
    try {messages.push({...entry,content:validateContent(await decryptMessage(room.local.key,entry.envelope,room.id,entry.sender_id,entry.id))});}
    catch {messages.push({...entry,error:'Unable to verify or decrypt this video.'});}
  }
  return {...response,messages};
}
export async function sendVideo(room,content) {
  if(room.keyError || !room.local || room.peer?.status!=='active') throw new Error(room.keyError || 'Pair with your friend before sharing.');
  const ctx=await client(), id=crypto.randomUUID(); content=validateContent(content);
  const envelope=await encryptMessage(room.local.key,content,room.id,ctx.identity.id,id);
  const item={id,roomId:room.id,envelope,createdAt:Date.now()};
  await update('outbox',items=>[...(items||[]),item]);
  await flushOutbox();
  return !(await storage.get('outbox')||[]).some(value=>value.id===id);
}
export async function flushOutbox() {
  const run=async()=>{
    const ctx=await client(); if(!ctx) return;
    const items=await storage.get('outbox')||[];
    for(const item of items) {
      if(item.error)continue;
      try {
        await ctx.api.request(`/rooms/${item.roomId}/messages`,{method:'POST',body:{id:item.id,envelope:item.envelope}});
        await update('outbox',values=>(values||[]).filter(value=>value.id!==item.id));
      } catch(error) {
        if([400,401,403,404,409,410].includes(error.status)) await update('outbox',values=>(values||[]).map(value=>value.id===item.id?{...value,error:error.message}:value));
        else break;
      }
    }
  };
  return navigator.locks ? navigator.locks.request('quicksend:flush',run) : run();
}
