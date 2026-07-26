/**
 * IndexedDB persistence layer.
 *
 * Raw API on purpose: the app has no runtime dependencies beyond React, and
 * what we need here fits in a hundred lines. Every entry point resolves instead
 * of rejecting — a browser with IndexedDB disabled, a private window, or a
 * blocked upgrade must degrade to localStorage rather than break the session.
 *
 * Two object stores:
 *   qstate — one record per question, keyed by question id
 *   meta   — a small key/value bag for settings, exam history and lastTopic
 *
 * Splitting them is the whole point of the migration: answering a question
 * writes one record instead of re-serialising all 632.
 */
import type { QState } from './types'

const DB_NAME = 'saa-study'
const DB_VERSION = 1
const QSTATE = 'qstate'
const META = 'meta'

/**
 * Safari has shipped versions where `indexedDB.open` in a private window never
 * fires success *or* error. Boot waits on hydration, so a hang there would
 * leave the app stuck behind the loading gate forever.
 */
const OPEN_TIMEOUT = 3_000

export interface Snapshot {
  q: Record<string, QState>
  meta: Record<string, unknown>
}

export interface WritePatch {
  /** Question states to upsert. A null value deletes the record. */
  q?: Record<string, QState | null>
  meta?: Record<string, unknown>
}

export function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    // Accessing the global itself throws in some locked-down configurations.
    return false
  }
}

let dbp: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbp) return dbp
  dbp = new Promise<IDBDatabase | null>((resolve) => {
    let settled = false
    const done = (db: IDBDatabase | null) => {
      if (settled) return
      settled = true
      resolve(db)
    }
    const timer = setTimeout(() => done(null), OPEN_TIMEOUT)
    const finish = (db: IDBDatabase | null) => {
      clearTimeout(timer)
      done(db)
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(QSTATE)) db.createObjectStore(QSTATE)
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
      }
      req.onsuccess = () => finish(req.result)
      req.onerror = () => finish(null)
      req.onblocked = () => finish(null)
    } catch {
      finish(null)
    }
  })
  return dbp
}

/** Reads both stores in one transaction. Null means "IndexedDB is unusable". */
export async function idbReadAll(): Promise<Snapshot | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise<Snapshot | null>((resolve) => {
    try {
      const tx = db.transaction([QSTATE, META], 'readonly')
      const qs = tx.objectStore(QSTATE)
      const ms = tx.objectStore(META)
      const qKeys = qs.getAllKeys()
      const qVals = qs.getAll()
      const mKeys = ms.getAllKeys()
      const mVals = ms.getAll()
      tx.oncomplete = () => {
        const q: Record<string, QState> = {}
        const meta: Record<string, unknown> = {}
        const qk = qKeys.result
        const qv = qVals.result as QState[]
        for (let i = 0; i < qk.length; i++) q[String(qk[i])] = qv[i]
        const mk = mKeys.result
        const mv = mVals.result as unknown[]
        for (let i = 0; i < mk.length; i++) meta[String(mk[i])] = mv[i]
        resolve({ q, meta })
      }
      tx.onerror = () => resolve(null)
      tx.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Upserts the given records. False means the write did not land. */
export async function idbWrite(patch: WritePatch): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction([QSTATE, META], 'readwrite')
      if (patch.q) {
        const s = tx.objectStore(QSTATE)
        for (const [id, v] of Object.entries(patch.q)) {
          if (v === null) s.delete(id)
          else s.put(v, id)
        }
      }
      if (patch.meta) {
        const s = tx.objectStore(META)
        for (const [k, v] of Object.entries(patch.meta)) s.put(v, k)
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Wipes both stores and writes the snapshot in a single transaction, so a
 * failure mid-way leaves the previous contents intact. Used by reset, import
 * and the one-time migration off localStorage.
 */
export async function idbReplaceAll(snap: Snapshot): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction([QSTATE, META], 'readwrite')
      const qs = tx.objectStore(QSTATE)
      const ms = tx.objectStore(META)
      qs.clear()
      ms.clear()
      for (const [id, v] of Object.entries(snap.q)) qs.put(v, id)
      for (const [k, v] of Object.entries(snap.meta)) ms.put(v, k)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Asks the browser not to evict our storage under pressure. Chrome decides
 * silently from engagement heuristics; Safari effectively grants it to
 * home-screen installs. Best effort — the answer changes nothing about how the
 * app behaves, so we only report it for the settings screen.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
