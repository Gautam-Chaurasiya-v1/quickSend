const isExtension = Boolean(globalThis.chrome?.runtime?.id);
export { isExtension };
export const storage = {
  async get(key) {
    if (isExtension) return (await chrome.storage.local.get(key))[key];
    const value = localStorage.getItem(`quicksend:${key}`); return value ? JSON.parse(value) : undefined;
  },
  async set(key, value) {
    if (isExtension) return chrome.storage.local.set({ [key]: value });
    localStorage.setItem(`quicksend:${key}`, JSON.stringify(value));
  }
};
// Serializes changes across popup, full view, and background in this browser profile.
export async function update(key, change) {
  const run = async () => { const value = await change(await storage.get(key)); await storage.set(key, value); return value; };
  return navigator.locks ? navigator.locks.request(`quicksend:${key}`, run) : run();
}
export async function saveRoom(room) { return update('roomKeys', value => ({ ...value, [room.id]: room })); }
