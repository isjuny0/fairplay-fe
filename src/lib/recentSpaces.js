const key = userId => `fairplay:recent-spaces:${globalThis.location?.pathname.startsWith('/preview') ? 'preview' : 'live'}:${userId}`;

export function recentSpaceIds(userId) {
  try {
    const value = JSON.parse(localStorage.getItem(key(userId)) || '[]');
    return Array.isArray(value) ? value.filter(Number.isSafeInteger).slice(0, 3) : [];
  } catch { return []; }
}

export function rememberSpace(userId, spaceId) {
  if (!userId || !Number.isSafeInteger(spaceId)) return;
  try {
    localStorage.setItem(key(userId), JSON.stringify([spaceId, ...recentSpaceIds(userId).filter(id => id !== spaceId)].slice(0, 3)));
  } catch { /* Navigation works even when storage is unavailable. */ }
}

export function clearRecentSpaces(userId) {
  try { localStorage.removeItem(key(userId)); } catch { /* Storage is optional. */ }
}
