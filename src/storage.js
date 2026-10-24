// localStorage can be missing or throw (private mode, in-app browsers), so every access is guarded
export function load(key, fallback) {
  try {
    const v = localStorage.getItem(`leguna:${key}`);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(`leguna:${key}`, JSON.stringify(value));
  } catch {
    // ignore: progress just won't persist
  }
}
