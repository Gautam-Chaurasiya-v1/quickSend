export function youtubeVideo(raw) {
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  let id;
  if (url.hostname === 'youtu.be') id = url.pathname.split('/')[1];
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else if (/^\/(shorts|live|embed)\//.test(url.pathname)) id = url.pathname.split('/')[2];
  }
  return /^[\w-]{11}$/.test(id || '') ? `https://youtu.be/${id}` : null;
}
export function backendOrigin(raw) {
  const url = new URL(raw.trim());
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('Use an HTTPS server origin, or http://localhost:8787 for development.');
  return url.origin;
}
export function displayName(raw, max = 40) {
  const value = String(raw || '').trim();
  if (!value || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`Enter a name with 1–${max} characters.`);
  return value;
}
export function parseInvite(raw) {
  raw = invitationCode(raw);
  let value;
  try { value = JSON.parse(atob(raw.trim().replace(/^qs1\./, ''))); } catch { throw new Error('That invitation is not valid. Paste the complete qs1. code.'); }
  if (!raw.trim().startsWith('qs1.') || value.v !== 1 || !/^[A-Za-z0-9+/]{43}=$/.test(value.token) || !/^[a-f0-9 -]{64,79}$/.test(value.ownerFingerprint)) throw new Error('That invitation is not valid.');
  return { ...value, server: backendOrigin(value.server) };
}
export function makeInvite(server, token, ownerFingerprint) { return 'qs1.' + btoa(JSON.stringify({ v: 1, server, token, ownerFingerprint })); }
export function validateContent(value) {
  if (!value || !youtubeVideo(value.url) || typeof value.title !== 'string' || value.title.length > 300 || typeof value.note !== 'string' || value.note.length > 500) throw new Error('Invalid shared video.');
  return { url: youtubeVideo(value.url), title: value.title, note: value.note };
}

export function invitationCode(raw) {
  const input = String(raw).trim();
  if (input.startsWith('qs1.')) return input;
  try {
    const url = new URL(input);
    backendOrigin(url.origin);
    const code = new URLSearchParams(url.hash.slice(1)).get('invite');
    if (url.pathname !== '/invite' || !code?.startsWith('qs1.')) throw Error();
    const value = JSON.parse(atob(code.slice(4)));
    if (backendOrigin(value.server) !== url.origin) throw Error();
    return code;
  } catch { throw new Error('Paste a complete QuickSend invitation link or qs1. code.'); }
}
export function invitationLink(code) {
  const invite = parseInvite(code);
  return `${invite.server}/invite#invite=${encodeURIComponent(code)}`;
}
