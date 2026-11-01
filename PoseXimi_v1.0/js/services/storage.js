/** IndexedDB offline albums; localStorage only when IndexedDB unavailable. */
const DATABASE = "poseframe-local-gallery",
  STORE = "albums",
  BACKUP = "poseframe-fallback-albums";
function openDB() {
  return new Promise((ok, bad) => {
    if (!window.indexedDB) return bad(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DATABASE, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => bad(req.error);
  });
}
async function transaction(mode, value) {
  const db = await openDB();
  try {
    return await new Promise((ok, bad) => {
      const tx = db.transaction(
        STORE,
        mode === "read" ? "readonly" : "readwrite",
      );
      const store = tx.objectStore(STORE),
        req =
          mode === "read"
            ? store.getAll()
            : mode === "put"
              ? store.put(value)
              : store.delete(value);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => bad(req.error);
      tx.onerror = () => bad(tx.error);
    });
  } finally {
    db.close();
  }
}
function backupRead() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP) || "[]");
  } catch {
    return [];
  }
}
export async function readAlbums() {
  // Merge both stores: a fallback write must not disappear when IndexedDB becomes readable again.
  let dbAlbums = [];
  try {
    dbAlbums = await transaction("read");
  } catch {
    /* Local fallback remains available. */
  }
  const all = new Map(backupRead().map((album) => [album.id, album]));
  dbAlbums.forEach((album) => all.set(album.id, album));
  return [...all.values()].sort((a, b) => b.createdAt - a.createdAt);
}
export async function storeAlbum(album) {
  try {
    await transaction("put", album);
  } catch {
    const list = backupRead();
    list.push(album);
    localStorage.setItem(BACKUP, JSON.stringify(list));
  }
}
export async function deleteAlbum(id) {
  let dbError;
  try {
    await transaction("delete", id);
  } catch (error) {
    dbError = error;
  }
  try {
    localStorage.setItem(
      BACKUP,
      JSON.stringify(backupRead().filter((a) => a.id !== id)),
    );
  } catch (error) {
    if (dbError) throw error;
  }
  // An unavailable IndexedDB is acceptable if the backup entry has been removed.
}
