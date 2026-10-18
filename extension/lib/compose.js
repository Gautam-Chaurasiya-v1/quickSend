import { youtubeVideo } from './validation.js';

/** Read only metadata made available by clicking the extension action. */
export async function captureYouTube(tabs) {
  try {
    const [tab] = await tabs.query({ active: true, currentWindow: true });
    const url = youtubeVideo(tab?.url);
    if (!url) return null;
    const title = String(tab.title || '')
      .replace(/^\(\d+\)\s*/, '')
      .replace(/\s*[-–—|]\s*YouTube\s*$/i, '')
      .trim().slice(0, 300);
    return { url, title: title === 'YouTube' ? '' : title };
  } catch { return null; }
}

export function selectedRoom(rooms, previous) {
  if (rooms.some(room => room.id === previous)) return previous;
  return rooms.find(room => room.status === 'active' && room.peer?.status === 'active' && room.local && !room.keyError)?.id || rooms[0]?.id || null;
}

export function composeDraft(capture, draft, now = Date.now()) {
  const valid = draft && typeof draft.url === 'string' && typeof draft.title === 'string' && typeof draft.note === 'string'
    && draft.url.length <= 2000 && draft.title.length <= 300 && draft.note.length <= 500
    && Number.isFinite(draft.updatedAt) && draft.updatedAt <= now && now - draft.updatedAt < 86400000;
  // A draft for a different video must never carry its note into a new capture.
  if (capture) return { url: capture.url, title: valid && youtubeVideo(draft.url) === capture.url ? draft.title : capture.title,
    note: valid && youtubeVideo(draft.url) === capture.url ? draft.note : '' };
  return valid ? { url: draft.url, title: draft.title, note: draft.note } : { url: '', title: '', note: '' };
}
