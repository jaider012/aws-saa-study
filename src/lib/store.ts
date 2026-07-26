import { useCallback, useSyncExternalStore } from 'react'
import type { Snapshot } from './idb'
import { idbAvailable, idbReadAll, idbReplaceAll, idbWrite, requestPersistence } from './idb'
import type { ExamResult, QState, Settings, Store, TopicId } from './types'

/**
 * Progress lives in IndexedDB, but the in-memory copy is the source of truth
 * the UI reads. That split matters: `stateOf` is called synchronously from
 * inside filter and sort callbacks in session.ts, so the read path can never
 * become async. IndexedDB sits behind it as write-behind storage, flushed on a
 * short debounce so a burst of answers costs one transaction.
 *
 * localStorage is still the fallback for browsers where IndexedDB is
 * unavailable, and the source of the one-time migration for existing progress.
 */

/** Legacy blob, still the fallback backend and the migration source. */
const KEY = 'saa.progress.v1'
/** Where the blob is parked after a successful migration, as an escape hatch. */
const BACKUP_KEY = 'saa.progress.migrated.v1'
const DAY = 86_400_000
const FLUSH_MS = 250

const EMPTY: Store = {
  version: 1,
  q: {},
  exams: [],
  settings: { shuffleOptions: true, instantFeedback: true },
}

let state: Store = EMPTY
let backend: 'idb' | 'local' = 'local'
let hydrated = false
let persisted = false

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

// ── shape conversion ───────────────────────────────────────────────────────
function normalise(s: Partial<Store> | null | undefined): Store | null {
  if (!s || s.version !== 1 || typeof s.q !== 'object' || s.q === null) return null
  return {
    version: 1,
    q: s.q as Record<string, QState>,
    exams: Array.isArray(s.exams) ? s.exams : [],
    settings: { ...EMPTY.settings, ...s.settings },
    lastTopic: s.lastTopic,
  }
}

/** Everything that is not per-question state, as the meta store's key/values. */
function metaOf(s: Store): Record<string, unknown> {
  // lastTopic is optional; IndexedDB stores the absence as an explicit null so
  // clearing it overwrites the previous value instead of leaving it behind.
  return { version: 1, settings: s.settings, exams: s.exams, lastTopic: s.lastTopic ?? null }
}

function snapshotOf(s: Store): Snapshot {
  return { q: s.q, meta: metaOf(s) }
}

function storeFromSnapshot(snap: Snapshot): Store | null {
  if (snap.meta.version !== 1) return null
  return normalise({
    version: 1,
    q: snap.q,
    exams: snap.meta.exams as ExamResult[],
    settings: snap.meta.settings as Settings,
    lastTopic: (snap.meta.lastTopic as TopicId | null) ?? undefined,
  })
}

// ── localStorage backend ───────────────────────────────────────────────────
function readLocal(key = KEY): Store | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? normalise(JSON.parse(raw) as Store) : null
  } catch {
    return null
  }
}

function writeLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage full or disabled — the session still works in memory */
  }
}

// ── hydration ──────────────────────────────────────────────────────────────
async function hydrate() {
  const legacy = readLocal()
  const snap = idbAvailable() ? await idbReadAll() : null

  if (!snap) {
    // No usable IndexedDB: behave exactly as the app did before.
    backend = 'local'
    state = legacy ?? EMPTY
  } else {
    backend = 'idb'
    const stored = storeFromSnapshot(snap)
    if (stored) {
      state = stored
    } else if (legacy) {
      // First run against IndexedDB with progress already in localStorage.
      state = legacy
      if (await idbReplaceAll(snapshotOf(state))) {
        try {
          localStorage.setItem(BACKUP_KEY, JSON.stringify(legacy))
          localStorage.removeItem(KEY)
        } catch {
          /* the migration itself succeeded; the backup copy is a nicety */
        }
      } else {
        backend = 'local'
      }
    } else {
      state = EMPTY
      // Stamp the version so a later boot can tell "empty" from "never used".
      if (!(await idbWrite({ meta: metaOf(EMPTY) }))) backend = 'local'
    }
    if (backend === 'idb') persisted = await requestPersistence()
  }

  hydrated = true
  notify()
}

/** Resolves once progress has been loaded. The UI gates its first paint on it. */
export const ready: Promise<void> = hydrate()

export function useHydrated() {
  return useSyncExternalStore(subscribe, () => hydrated, () => hydrated)
}

/** Which backend won, for the settings screen. Only meaningful after `ready`. */
export function storageInfo() {
  return { backend, persisted }
}

// ── write-behind ───────────────────────────────────────────────────────────
const dirtyQ = new Set<string>()
let dirtyMeta = false
let dirtyAll = false
let timer: ReturnType<typeof setTimeout> | null = null
let queue: Promise<void> = Promise.resolve()

function degradeToLocal() {
  backend = 'local'
  writeLocal()
}

async function doFlush() {
  if (!dirtyAll && !dirtyMeta && dirtyQ.size === 0) return
  if (backend === 'local') {
    dirtyAll = dirtyMeta = false
    dirtyQ.clear()
    writeLocal()
    return
  }

  const all = dirtyAll
  const ids = [...dirtyQ]
  const meta = dirtyMeta
  dirtyAll = dirtyMeta = false
  dirtyQ.clear()

  // Pin the value being written: `state` can be replaced while we await.
  const pinned = state
  const ok = all
    ? await idbReplaceAll(snapshotOf(pinned))
    : await idbWrite({
        q: Object.fromEntries(ids.map((id) => [id, pinned.q[id] ?? null])),
        meta: meta ? metaOf(pinned) : undefined,
      })
  if (!ok) degradeToLocal()
}

/** Flushes run one at a time so two transactions can't interleave. */
function flush(): Promise<void> {
  queue = queue.then(doFlush)
  return queue
}

function schedule(dirty: { q?: string; meta?: boolean; all?: boolean }) {
  if (dirty.q) dirtyQ.add(dirty.q)
  if (dirty.meta) dirtyMeta = true
  if (dirty.all) dirtyAll = true
  if (timer !== null) return
  timer = setTimeout(() => {
    timer = null
    void flush()
  }, FLUSH_MS)
}

/** Writes any pending changes immediately. */
export function flushNow(): Promise<void> {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  return flush()
}

if (typeof window !== 'undefined') {
  // Closing the tab right after an answer must not lose the debounce window.
  const onHide = () => {
    if (timer !== null || dirtyQ.size || dirtyMeta || dirtyAll) void flushNow()
  }
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide()
  })
}

function commit(next: Store, dirty: { q?: string; meta?: boolean; all?: boolean }) {
  state = next
  schedule(dirty)
  notify()
}

// ── reads ──────────────────────────────────────────────────────────────────
export function useStore() {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

export function blankState(now = Date.now()): QState {
  return {
    seen: 0, correct: 0, streak: 0, lastAt: 0, lastOk: false,
    ease: 2.5, interval: 0, due: now, reps: 0,
  }
}

export function stateOf(id: string): QState {
  return state.q[id] ?? blankState()
}

/** A question counts as mastered after two consecutive correct answers. */
export function isMastered(s: QState) {
  return s.streak >= 2
}

// ── writes ─────────────────────────────────────────────────────────────────
export function recordAnswer(id: string, ok: boolean) {
  const now = Date.now()
  const prev = state.q[id] ?? blankState(now)
  const next: QState = {
    ...prev,
    seen: prev.seen + 1,
    correct: prev.correct + (ok ? 1 : 0),
    streak: ok ? prev.streak + 1 : 0,
    lastAt: now,
    lastOk: ok,
  }
  // Practice results also feed the review schedule, so the two modes agree on
  // what still needs work.
  if (ok) {
    next.reps = prev.reps + 1
    next.interval = prev.reps === 0 ? 1 : prev.reps === 1 ? 3 : Math.round(prev.interval * prev.ease)
    next.due = now + next.interval * DAY
  } else {
    next.reps = 0
    next.interval = 0
    next.ease = Math.max(1.3, prev.ease - 0.2)
    next.due = now
  }
  commit({ ...state, q: { ...state.q, [id]: next } }, { q: id })
}

/** Self-grading from the flashcard mode: 0 again · 1 hard · 2 good · 3 easy. */
export function gradeCard(id: string, grade: 0 | 1 | 2 | 3) {
  const now = Date.now()
  const prev = state.q[id] ?? blankState(now)
  const ok = grade >= 2
  const next: QState = {
    ...prev,
    seen: prev.seen + 1,
    correct: prev.correct + (ok ? 1 : 0),
    streak: ok ? prev.streak + 1 : 0,
    lastAt: now,
    lastOk: ok,
  }
  if (grade === 0) {
    next.reps = 0
    next.interval = 0
    next.ease = Math.max(1.3, prev.ease - 0.2)
    next.due = now
  } else {
    const bump = grade === 1 ? -0.15 : grade === 2 ? 0 : 0.15
    next.ease = Math.min(2.8, Math.max(1.3, prev.ease + bump))
    next.reps = prev.reps + 1
    next.interval =
      next.reps === 1 ? (grade === 1 ? 1 : 2)
      : next.reps === 2 ? (grade === 1 ? 3 : 5)
      : Math.max(1, Math.round(prev.interval * next.ease * (grade === 1 ? 0.6 : 1)))
    next.due = now + next.interval * DAY
  }
  commit({ ...state, q: { ...state.q, [id]: next } }, { q: id })
}

export function toggleFlag(id: string) {
  const prev = state.q[id] ?? blankState()
  commit({ ...state, q: { ...state.q, [id]: { ...prev, flagged: !prev.flagged } } }, { q: id })
}

export function saveExam(result: ExamResult) {
  commit({ ...state, exams: [result, ...state.exams].slice(0, 25) }, { meta: true })
}

export function setSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } }, { meta: true })
}

export function setLastTopic(topic: TopicId) {
  if (state.lastTopic === topic) return
  commit({ ...state, lastTopic: topic }, { meta: true })
}

export function resetProgress() {
  commit({ ...EMPTY, settings: state.settings }, { all: true })
}

export function exportProgress() {
  return JSON.stringify(state, null, 2)
}

export function importProgress(json: string): boolean {
  try {
    const parsed = normalise(JSON.parse(json) as Store)
    if (!parsed) return false
    commit(parsed, { all: true })
    return true
  } catch {
    return false
  }
}

/** Convenience hook: the live state for one question plus its actions. */
export function useQuestionState(id: string) {
  const store = useStore()
  const flag = useCallback(() => toggleFlag(id), [id])
  return { state: store.q[id] ?? blankState(), flag }
}
