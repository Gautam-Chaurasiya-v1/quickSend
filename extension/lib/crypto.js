/** Versioned, browser-native encryption. Private keys only transfer inside an explicitly approved encrypted device snapshot. */
const enc = new TextEncoder();
const dec = new TextDecoder();
export const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
export const randomSecret = () => toBase64(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))), b => b.toString(16).padStart(2, '0')).join('');
export function publicIdentity(key) { return { kty: 'EC', crv: 'P-256', x: key.x, y: key.y, ext: true }; }
export const fingerprint = async key => (await hash(JSON.stringify(publicIdentity(key)))).match(/.{1,4}/g).join(' ');
export async function generateIdentity(name) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { id: crypto.randomUUID(), name, token: randomSecret(), publicKey: publicIdentity(await crypto.subtle.exportKey('jwk', pair.publicKey)), privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey) };
}
async function aes(raw) { return crypto.subtle.importKey('raw', fromBase64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function sealWith(key, value, context) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(context), tagLength: 128 }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, iv: toBase64(iv), data: toBase64(data) };
}
async function openWith(key, envelope, context) {
  if (envelope?.v !== 1 || fromBase64(envelope.iv).length !== 12) throw new Error('Unsupported encrypted message.');
  const value = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv), additionalData: enc.encode(context), tagLength: 128 }, key, fromBase64(envelope.data));
  return JSON.parse(dec.decode(value));
}
export const encryptMessage = async (key, message, roomId, senderId, messageId) => sealWith(await aes(key), message, `quicksend:message:v1:${roomId}:${senderId}:${messageId}`);
export const decryptMessage = async (key, envelope, roomId, senderId, messageId) => openWith(await aes(key), envelope, `quicksend:message:v1:${roomId}:${senderId}:${messageId}`);
async function pairingKey(identity, peerKey, roomId) {
  const own = await crypto.subtle.importKey('jwk', identity.privateKey, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const peer = await crypto.subtle.importKey('jwk', publicIdentity(peerKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, own, 256);
  const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode(roomId), info: enc.encode('quicksend:pairing:v1') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function wrapRoom(identity, peerKey, room, peerId) {
  return sealWith(await pairingKey(identity, peerKey, room.id), { key: room.key, name: room.name }, `quicksend:room:v1:${room.id}:${identity.id}:${peerId}`);
}
export async function unwrapRoom(identity, ownerKey, envelope, roomId, ownerId) {
  const room = await openWith(await pairingKey(identity, ownerKey, roomId), envelope, `quicksend:room:v1:${roomId}:${ownerId}:${identity.id}`);
  if (fromBase64(room.key).length !== 32 || typeof room.name !== 'string' || room.name.length > 60) throw new Error('Invalid room key.');
  return { id: roomId, ...room };
}
async function backupKey(password, salt) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('Use a backup password with at least 12 characters.');
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
}
export async function encryptBackup(value, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { format: 'quicksend-backup-v1', salt: toBase64(salt), payload: await sealWith(await backupKey(password,salt),value,'quicksend:backup:v1') };
}
export async function decryptBackup(value, password) {
  if (value?.format !== 'quicksend-backup-v1' || typeof value.salt !== 'string' || fromBase64(value.salt).length!==16) throw new Error('Unsupported backup file.');
  try { return await openWith(await backupKey(password,fromBase64(value.salt)),value.payload,'quicksend:backup:v1'); }
  catch { throw new Error('Could not unlock backup. Check the password and file.'); }
}

// Device transfer has a separate HKDF salt namespace and AAD from room envelopes.
export async function encryptTransfer(identity, recipientKey, sessionId, snapshot) {
  return sealWith(await pairingKey(identity, recipientKey, `device:${sessionId}`), snapshot, `quicksend:device:v1:${sessionId}`);
}
export async function decryptTransfer(recipient, senderKey, sessionId, payload) {
  return openWith(await pairingKey(recipient, senderKey, `device:${sessionId}`), payload, `quicksend:device:v1:${sessionId}`);
}
