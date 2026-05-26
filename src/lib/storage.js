/* Wrapper simple autour de localStorage avec parse/stringify et gestion d'erreur. */

const PREFIX = 'ara.'

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch (e) {
    console.warn(`[storage] lecture ${key} :`, e)
    return fallback
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (e) {
    console.warn(`[storage] écriture ${key} :`, e)
  }
}

export function removeKey(key) {
  localStorage.removeItem(PREFIX + key)
}
