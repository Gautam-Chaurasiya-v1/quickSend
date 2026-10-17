import { Api } from './api.js';
import { storage, isExtension } from './storage.js';
import { client } from './client.js';
import { generateIdentity, randomSecret, hash, fingerprint, encryptTransfer, decryptTransfer, fromBase64 } from './crypto.js';
import { backendOrigin, displayName } from './validation.js';

const relay = (server, secret) => new Api(server, {token:secret});
export function parsePairing(raw) {
  try {
    const value=JSON.parse(atob(raw.trim().replace(/^qsd1\./,'')));
    if(!raw.trim().startsWith('qsd1.') || value.v!==1 || !/^[a-f0-9-]{36}$/.test(value.id) || fromBase64(value.secret).length!==32 || value.publicKey?.d || value.publicKey?.crv!=='P-256')throw Error();
    return {...value,server:backendOrigin(value.server)};
  } catch {throw new Error('Paste the complete qsd1. device pairing code.');}
}
export async function startPairing(server) {
  if(await client())throw new Error('Use a fresh browser profile to receive your identity.');
  server=backendOrigin(server);
  const existing=await storage.get('devicePairing');
  if(existing && existing.server===server && existing.expiresAt>Date.now())return existing;
  const identity=await generateIdentity('New browser'),secret=randomSecret(),id=crypto.randomUUID();
  const {expiresAt}=await relay(server,secret).request('/device-pairings',{method:'POST',body:{id,secretHash:await hash(secret),publicKey:identity.publicKey}});
  const code='qsd1.'+btoa(JSON.stringify({v:1,id,secret,server,publicKey:identity.publicKey}));
  const session={id,secret,server,identity,expiresAt,code};await storage.set('devicePairing',session);return session;
}
export async function approveDevice(raw) {
  const request=parsePairing(raw),ctx=await client();
  if(!ctx || request.server!==ctx.server)throw new Error('Both browsers must use the same shared server.');
  if((await storage.get('outbox')||[]).length)throw new Error('Send or discard unsent videos before pairing.');
  const api=relay(request.server,request.secret),remote=await api.request(`/device-pairings/${request.id}`);
  if(await fingerprint(remote.publicKey)!==await fingerprint(request.publicKey))throw new Error('Pairing key changed. Cancel and start again.');
  const snapshot={v:1,identity:ctx.identity,settings:{server:ctx.server},roomKeys:await storage.get('roomKeys')||{},pins:await storage.get('pins')||{}};
  const envelope=await encryptTransfer(ctx.identity,request.publicKey,request.id,snapshot);
  await api.request(`/device-pairings/${request.id}`,{method:'POST',body:{senderKey:ctx.identity.publicKey,envelope}});
}
export async function receiveDevice(session) {
  if(session.expiresAt<=Date.now())throw new Error('Pairing expired. Start again.');
  const result=await relay(session.server,session.secret).request(`/device-pairings/${session.id}`);
  if(!result.envelope)return null;
  const snapshot=await decryptTransfer(session.identity,result.senderKey,session.id,result.envelope);
  await validateSnapshot(snapshot);
  if(snapshot.settings.server!==session.server || await fingerprint(snapshot.identity.publicKey)!==await fingerprint(result.senderKey))throw new Error('Pairing sender does not match the transferred identity.');
  return {snapshot,fingerprint:await fingerprint(result.senderKey)};
}
export async function validateSnapshot(value) {
  if(value?.v!==1 || !value.identity?.id || !value.identity?.privateKey || !value.identity?.publicKey || !value.identity?.token || !value.roomKeys || typeof value.roomKeys!=='object' || Array.isArray(value.roomKeys))throw new Error('This identity snapshot is incomplete.');
  backendOrigin(value.settings.server);displayName(value.identity.name);
  if(fromBase64(value.identity.token).length!==32 || Object.keys(value.roomKeys).length>10)throw new Error('Invalid identity snapshot.');
  const key=await crypto.subtle.importKey('jwk',value.identity.privateKey,{name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const exported=await crypto.subtle.exportKey('jwk',key);
  if(exported.x!==value.identity.publicKey.x||exported.y!==value.identity.publicKey.y)throw new Error('Identity keys do not match.');
  for(const [id,room] of Object.entries(value.roomKeys))if(room.id!==id || fromBase64(room.key).length!==32 || typeof room.name!=='string' || room.name.length>60)throw new Error('Invalid room keys.');
  return value;
}
export async function restoreSnapshot(value) {
  await validateSnapshot(value);
  if((await storage.get('outbox')||[]).length)throw new Error('Send or discard unsent videos before restoring.');
  await new Api(value.settings.server,value.identity).request('/rooms');
  const restored={identity:value.identity,settings:{server:value.settings.server},roomKeys:value.roomKeys,pins:value.pins||{},selectedRoom:null,cachedRooms:[],cachedMessages:{},devicePairing:null};
  if(isExtension)await chrome.storage.local.set(restored);
  else for(const [key,data] of Object.entries(restored))await storage.set(key,data);
}
export async function cancelPairing(session) {
  await relay(session.server,session.secret).request(`/device-pairings/${session.id}`,{method:'DELETE'});
  await storage.set('devicePairing',null);
}
