import { youtubeVideo } from './validation.js';

/** A response for an old room or a now-hidden inbox must never consume unread state. */
export function canAcknowledge({ isPopup, view, requestedRoomId, selectedRoomId, visible, focused, offline, obscured = false, messages }) {
  return (!isPopup || view === 'inbox') && requestedRoomId === selectedRoomId && visible && focused && !offline && !obscured
    && messages.length > 0 && messages.every(message => !message.error);
}

/** Use the extension's own browser/profile rather than handing a URL to the OS. */
export async function openYouTube(raw, tabs) {
  const url = youtubeVideo(raw);
  if (!url) throw new Error('This is not a valid YouTube video.');
  return tabs.create({ url, active: true });
}
