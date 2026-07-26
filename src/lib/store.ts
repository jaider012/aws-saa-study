import { useCallback, useSyncExternalStore } from 'react'
import type { ExamResult, QState, Settings, Store, TopicId } from './types'

const KEY = 'saa.progress.v1'
const DAY = 86_400_000

const EMPTY: Store = {
  version: 1,
  q: {},
  exams: [],
  settings: { shuffleOptions: true, instantFeedback: true },
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Store
    if (parsed?.version !== 1) return EMPTY
    return { ...EMPTY, ...parsed, settings: { ...EMPTY.settings, ...parsed.settings } }
  } catch {
    return EMPTY
  }
}

let state = read()
const listeners = new Set<() => void>()

function commit(next: Store) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or disabled — the session still works in memory */
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

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
  commit({ ...state, q: { ...state.q, [id]: next } })
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
  commit({ ...state, q: { ...state.q, [id]: next } })
}

export function toggleFlag(id: string) {
  const prev = state.q[id] ?? blankState()
  commit({ ...state, q: { ...state.q, [id]: { ...prev, flagged: !prev.flagged } } })
}

export function saveExam(result: ExamResult) {
  commit({ ...state, exams: [result, ...state.exams].slice(0, 25) })
}

export function setSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } })
}

export function setLastTopic(topic: TopicId) {
  if (state.lastTopic === topic) return
  commit({ ...state, lastTopic: topic })
}

export function resetProgress() {
  commit({ ...EMPTY, settings: state.settings })
}

export function exportProgress() {
  return JSON.stringify(state, null, 2)
}

export function importProgress(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as Store
    if (parsed?.version !== 1 || typeof parsed.q !== 'object') return false
    commit({ ...EMPTY, ...parsed, settings: { ...EMPTY.settings, ...parsed.settings } })
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
