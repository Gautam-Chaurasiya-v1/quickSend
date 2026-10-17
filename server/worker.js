import { landingResponse } from './landing.js';
const encoder = new TextEncoder();
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const sha = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))), b => b.toString(16).padStart(2, '0')).join('');
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, text) => { throw new HttpError(status, text); };
function text(value, max) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) fail(400, 'Invalid text field.'); return value.trim(); }
function envelope(value, max = 8192) {
  if (value?.v !== 1 || typeof value.iv !== 'string' || !/^[A-Za-z0-9+/]{16}$/.test(value.iv) || typeof value.data !== 'string' || value.data.length < 24 || value.data.length > max || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.data)) fail(400, 'Invalid encrypted payload.');
  return JSON.stringify({ v: 1, iv: value.iv, data: value.data });
}
async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'Use application/json.');
  const reader = request.body?.getReader(); if (!reader) fail(400, 'A JSON body is required.');
  const chunks = []; let length = 0;
  while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > (new URL(request.url).pathname.startsWith('/v1/device-pairings') ? 100000 : 16384)) { await reader.cancel(); fail(413, 'Request too large.'); } chunks.push(part.value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const parsed = JSON.parse(new TextDecoder().decode(bytes)); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error(); return parsed; } catch { fail(400, 'Invalid JSON.'); }
}
async function limit(db, key, max, windowMs) {
  const now = Date.now(); const bucket = `${key}:${Math.floor(now / windowMs)}`;
  const row = await db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(bucket, now + windowMs).first();
  if (row.count > max) fail(429, 'Too many requests. Please wait and retry.');
}
async function member(db, roomId, userId, active = true) {
  const record = await db.prepare('SELECT m.*,r.owner_id FROM members m JOIN rooms r ON r.id=m.room_id WHERE m.room_id=? AND m.user_id=?').bind(roomId, userId).first();
  if (!record || (active && record.status !== 'active')) fail(404, 'Room not available.');
  return record;
}
async function owner(db, roomId, userId) { const row = await member(db, roomId, userId); if (row.owner_id !== userId) fail(403, 'Only the room owner can do that.'); return row; }
function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return '';
  if (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return origin;
  if (env.DEV === 'true' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin;
  fail(403, 'Origin not allowed.');
}
export async function handle(request, env) {
  let origin = '';
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Vary': 'Origin' };
  try {
    const landing = landingResponse(request);
    if (landing) return landing;
    origin = allowedOrigin(request, env);
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
    headers['Access-Control-Max-Age'] = '600';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url), path = url.pathname, method = request.method, db = env.DB;
    if (path.startsWith('/v1/device-pairings')) {
      const response = await devicePairing(request, db, url);
      return Response.json(response, { headers });
    }
    if (path === '/v1/health' && method === 'GET') return Response.json({ ok: true, version: 1 }, { headers });
    let result;
    if (path === '/v1/identities' && method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      await limit(db, `register:${await sha(`${new Date().toISOString().slice(0,10)}:${ip}`)}`, 20, 3600000);
      const data = await body(request);
      if (!uuid(data.id) || !/^[a-f0-9]{64}$/.test(data.tokenHash)) fail(400, 'Invalid device credentials.');
      const key = data.publicKey;
      if (key?.kty !== 'EC' || key.crv !== 'P-256' || typeof key.x !== 'string' || typeof key.y !== 'string' || key.x.length !== 43 || key.y.length !== 43 || key.d) fail(400, 'Invalid public key.');
      try { await crypto.subtle.importKey('jwk', key, { name: 'ECDH', namedCurve: 'P-256' }, false, []); } catch { fail(400, 'Invalid public key.'); }
      const publicKey = JSON.stringify({ kty: 'EC', crv: 'P-256', x: key.x, y: key.y, ext: true });
      const existing = await db.prepare('SELECT * FROM identities WHERE id=?').bind(data.id).first();
      if (existing && (existing.token_hash !== data.tokenHash || existing.public_key !== publicKey)) fail(409, 'Device identity already exists.');
      if (!existing) await db.prepare('INSERT INTO identities(id,token_hash,name,public_key,created_at) VALUES(?,?,?,?,?)').bind(data.id, data.tokenHash, text(data.name,40), publicKey, Date.now()).run();
      result = { id: data.id };
    } else {
      const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
      if (!token || !/^[A-Za-z0-9+/]{43}=$/.test(token)) fail(401, 'Device authentication required.');
      const user = await db.prepare('SELECT id,name,public_key FROM identities WHERE token_hash=?').bind(await sha(token)).first();
      if (!user) fail(401, 'Device authentication expired or invalid.');
      await limit(db, `device:${user.id}`, 100, 60000);
      if (path === '/v1/rooms' && method === 'GET') {
        const { results } = await db.prepare(`SELECT r.id,r.owner_id,r.created_at,m.status,m.envelope,m.last_read_seq,
          (SELECT COUNT(*) FROM (SELECT seq FROM messages msg WHERE msg.room_id=r.id AND msg.seq>m.last_read_seq AND msg.sender_id!=? LIMIT 100)) unread
          FROM members m JOIN rooms r ON r.id=m.room_id WHERE m.user_id=? ORDER BY r.created_at DESC`).bind(user.id,user.id).all();
        for (const room of results) {
          room.envelope = room.envelope ? JSON.parse(room.envelope) : null;
          const peers = await db.prepare('SELECT m.user_id id,m.status,i.name,i.public_key FROM members m JOIN identities i ON i.id=m.user_id WHERE m.room_id=?').bind(room.id).all();
          room.members = peers.results.map(peer => ({ ...peer, publicKey: JSON.parse(peer.public_key), public_key: undefined }));
        }
        result = { rooms: results };
      } else if (path === '/v1/rooms' && method === 'POST') {
        const data = await body(request); if (!uuid(data.id)) fail(400, 'Invalid room ID.');
        const existing = await db.prepare('SELECT owner_id FROM rooms WHERE id=?').bind(data.id).first();
        if (existing && existing.owner_id !== user.id) fail(409, 'Room ID already in use.');
        if (!existing) {
          const count = await db.prepare('SELECT COUNT(*) count FROM members WHERE user_id=?').bind(user.id).first();
          if (count.count >= 10) fail(409, 'This version allows 10 rooms per device.');
          await db.batch([
            db.prepare('INSERT INTO rooms(id,owner_id,created_at) VALUES(?,?,?)').bind(data.id,user.id,Date.now()),
            db.prepare('INSERT INTO members(room_id,user_id,status,created_at) VALUES(?,?,?,?)').bind(data.id,user.id,'active',Date.now())
          ]);
        }
        result = { id: data.id };
      } else if (path === '/v1/join' && method === 'POST') {
        const data = await body(request); if (!/^[A-Za-z0-9+/]{43}=$/.test(data.token)) fail(400, 'Invalid invitation.');
        const tokenHash = await sha(data.token);
        const invite = await db.prepare('SELECT i.*,r.owner_id FROM invites i JOIN rooms r ON r.id=i.room_id WHERE token_hash=?').bind(tokenHash).first();
        if (!invite || invite.expires_at < Date.now() || (invite.claimed_by && invite.claimed_by !== user.id)) fail(410, 'Invitation expired, used, or revoked. Ask for a new one.');
        if (invite.owner_id === user.id) fail(400, 'Use another browser profile or device to join your room.');
        const count = await db.prepare('SELECT COUNT(*) count FROM members WHERE user_id=?').bind(user.id).first();
        if (count.count >= 10) fail(409, 'This version allows 10 rooms per device.');
        const existing = await db.prepare('SELECT status FROM members WHERE room_id=? AND user_id=?').bind(invite.room_id,user.id).first();
        if (invite.claimed_by && !existing) fail(410, 'Invitation was already consumed. Ask for a new one.');
        if (!existing) {
          try { await db.batch([
            db.prepare('UPDATE invites SET claimed_by=? WHERE token_hash=? AND claimed_by IS NULL AND expires_at>?').bind(user.id,tokenHash,Date.now()),
            db.prepare("INSERT INTO members(room_id,user_id,status,created_at) SELECT room_id,?,'pending',? FROM invites WHERE token_hash=? AND claimed_by=?").bind(user.id,Date.now(),tokenHash,user.id)
          ]); } catch (error) { if (String(error).includes('room_full')) fail(409, 'Room already has a member or pending request.'); throw error; }
          const joined = await db.prepare('SELECT status FROM members WHERE room_id=? AND user_id=?').bind(invite.room_id,user.id).first();
          if (!joined) fail(410, 'Invitation was already claimed.');
        }
        const owner = await db.prepare('SELECT id,name,public_key FROM identities WHERE id=?').bind(invite.owner_id).first();
        result = { roomId: invite.room_id, owner: { id: owner.id, name: owner.name, publicKey: JSON.parse(owner.public_key) } };
      } else {
        const match = path.match(/^\/v1\/rooms\/([\da-f-]+)(?:\/(invites|approve|reject|messages|read|leave))?$/);
        if (!match || !uuid(match[1])) fail(404, 'Endpoint not found.');
        const [, roomId, action] = match;
        if (action === 'invites' && method === 'POST') {
          await owner(db,roomId,user.id);
          const count = await db.prepare('SELECT COUNT(*) count FROM members WHERE room_id=?').bind(roomId).first();
          if (count.count >= 2) fail(409, 'This room already has a member or pending request.');
          const data = await body(request); if (!/^[a-f0-9]{64}$/.test(data.tokenHash)) fail(400, 'Invalid invitation token.');
          const expiresAt = Date.now() + 15*60000;
          await db.batch([
            db.prepare('DELETE FROM invites WHERE room_id=?').bind(roomId),
            db.prepare('INSERT INTO invites(token_hash,room_id,expires_at) VALUES(?,?,?)').bind(data.tokenHash,roomId,expiresAt)
          ]);
          result = { expiresAt };
        } else if (action === 'invites' && method === 'DELETE') {
          await owner(db,roomId,user.id); await db.prepare('DELETE FROM invites WHERE room_id=?').bind(roomId).run(); result = { ok: true };
        } else if (action === 'approve' && method === 'POST') {
          await owner(db,roomId,user.id); const data = await body(request); if (!uuid(data.userId)) fail(400, 'Invalid member ID.');
          const payload = envelope(data.envelope);
          const peer = await db.prepare("SELECT status FROM members WHERE room_id=? AND user_id=? AND user_id!=?").bind(roomId,data.userId,user.id).first();
          if (!peer) fail(404, 'Join request no longer available.');
          const changed = await db.prepare("UPDATE members SET status='active',envelope=? WHERE room_id=? AND user_id=? AND status='pending'").bind(payload,roomId,data.userId).run();
          result = { ok: true, approved: changed.meta.changes > 0 || peer.status === 'active' };
        } else if (action === 'reject' && method === 'POST') {
          await owner(db,roomId,user.id); const data = await body(request);
          await db.prepare("DELETE FROM members WHERE room_id=? AND user_id=? AND status='pending'").bind(roomId,typeof data.userId === 'string' ? data.userId : '').run(); result = { ok: true };
        } else if (action === 'messages' && method === 'GET') {
          await member(db,roomId,user.id);
          const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
          if (!Number.isSafeInteger(before) || before < 1) fail(400, 'Invalid cursor.');
          const rows = await db.prepare('SELECT * FROM messages WHERE room_id=? AND seq<? ORDER BY seq DESC LIMIT 41').bind(roomId,before).all();
          const hasMore = rows.results.length > 40;
          result = { messages: rows.results.slice(0,40).reverse().map(row => ({ ...row, envelope: JSON.parse(row.envelope) })), hasMore };
        } else if (action === 'messages' && method === 'POST') {
          await member(db,roomId,user.id);
          const count = await db.prepare("SELECT COUNT(*) count FROM members WHERE room_id=? AND status='active'").bind(roomId).first();
          if (count.count !== 2) fail(409, 'Your friend must be approved before sharing.');
          const data = await body(request); if (!uuid(data.id)) fail(400, 'Invalid message ID.');
          const payload = envelope(data.envelope);
          const existing = await db.prepare('SELECT * FROM messages WHERE id=?').bind(data.id).first();
          if (existing && (existing.room_id !== roomId || existing.sender_id !== user.id || existing.envelope !== payload)) fail(409, 'Message ID conflict.');
          if (!existing) {
            await limit(db,`send:${user.id}`,300,86400000);
            await db.prepare('INSERT INTO messages(id,room_id,sender_id,envelope,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(data.id,roomId,user.id,payload,Date.now()).run();
          }
          result = { ok: true, id: data.id };
        } else if (action === 'read' && method === 'POST') {
          await member(db,roomId,user.id); const data = await body(request);
          if (!Number.isSafeInteger(data.seq) || data.seq < 0) fail(400, 'Invalid read cursor.');
          await db.prepare('UPDATE members SET last_read_seq=MAX(last_read_seq,MIN(?,COALESCE((SELECT MAX(seq) FROM messages WHERE room_id=?),0))) WHERE room_id=? AND user_id=?').bind(data.seq,roomId,roomId,user.id).run(); result = { ok: true };
        } else if (action === 'leave' && method === 'POST') {
          const membership = await member(db,roomId,user.id,false);
          if (membership.status === 'pending') {
            await db.prepare("DELETE FROM members WHERE room_id=? AND user_id=? AND status='pending'").bind(roomId,user.id).run();
          } else if (membership.owner_id === user.id) {
            await db.prepare('DELETE FROM rooms WHERE id=?').bind(roomId).run();
          } else {
            // Close rather than replace a member: the old room key must never be reused with a new peer.
            await db.prepare('DELETE FROM rooms WHERE id=?').bind(roomId).run();
          }
          result = { ok: true };
        } else fail(404,'Endpoint not found.');
      }
    }
    return Response.json(result,{ headers });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return Response.json({ error: status === 500 ? 'Server error. Please retry later.' : error.message }, { status, headers });
  }
}
export default {
  fetch: handle,
  async scheduled(_event, env) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM device_pairings WHERE expires_at<?').bind(Date.now()),
      env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(Date.now()),
      env.DB.prepare('DELETE FROM invites WHERE expires_at<?').bind(Date.now()),
      env.DB.prepare('DELETE FROM messages WHERE created_at<?').bind(Date.now()-90*86400000)
    ]);
  }
};

async function validPublicKey(key) {
  if (key?.kty !== 'EC' || key.crv !== 'P-256' || key.d || typeof key.x !== 'string' || key.x.length !== 43 || typeof key.y !== 'string' || key.y.length !== 43) fail(400, 'Invalid pairing key.');
  try { await crypto.subtle.importKey('jwk', key, {name:'ECDH',namedCurve:'P-256'}, false, []); } catch { fail(400, 'Invalid pairing key.'); }
  return JSON.stringify({kty:'EC',crv:'P-256',x:key.x,y:key.y,ext:true});
}
async function devicePairing(request, db, url) {
  const method=request.method;
  if (url.pathname === '/v1/device-pairings' && method === 'POST') {
    const ip=request.headers.get('CF-Connecting-IP') || 'local';
    await limit(db, `pair:${await sha(`${new Date().toISOString().slice(0,10)}:${ip}`)}`, 20, 3600000);
    const data=await body(request);
    if (!uuid(data.id) || !/^[a-f0-9]{64}$/.test(data.secretHash)) fail(400, 'Invalid pairing request.');
    const publicKey=await validPublicKey(data.publicKey), expiresAt=Date.now()+10*60000;
    await db.prepare('INSERT INTO device_pairings(id,secret_hash,public_key,expires_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(data.id,data.secretHash,publicKey,expiresAt).run();
    const row=await db.prepare('SELECT * FROM device_pairings WHERE id=?').bind(data.id).first();
    if(row.secret_hash!==data.secretHash || row.public_key!==publicKey) fail(409,'Pairing ID already in use.');
    return {expiresAt:row.expires_at};
  }
  const match=url.pathname.match(/^\/v1\/device-pairings\/([a-f0-9-]+)$/);
  if (!match || !uuid(match[1])) fail(404,'Pairing not found.');
  const secret=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(secret||'')) fail(401,'Pairing authorization required.');
  const row=await db.prepare('SELECT * FROM device_pairings WHERE id=? AND secret_hash=? AND expires_at>?').bind(match[1],await sha(secret),Date.now()).first();
  if (!row) fail(410,'Pairing expired or cancelled. Start again on the new browser.');
  if (method==='GET') return {publicKey:JSON.parse(row.public_key),senderKey:row.sender_key?JSON.parse(row.sender_key):null,envelope:row.envelope?JSON.parse(row.envelope):null,expiresAt:row.expires_at};
  if (method==='DELETE') {
    await db.prepare('DELETE FROM device_pairings WHERE id=? AND secret_hash=?').bind(row.id,row.secret_hash).run();
    return {ok:true};
  }
  if (method==='POST') {
    const data=await body(request), senderKey=await validPublicKey(data.senderKey), payload=envelope(data.envelope,65536);
    const changed=await db.prepare('UPDATE device_pairings SET sender_key=?,envelope=? WHERE id=? AND envelope IS NULL AND expires_at>?').bind(senderKey,payload,row.id,Date.now()).run();
    if (!changed.meta.changes && (row.sender_key!==senderKey || row.envelope!==payload)) fail(409,'Pairing was already approved. Start again if this was unexpected.');
    return {ok:true};
  }
  fail(405,'Method not allowed.');
}
