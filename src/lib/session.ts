import { QUESTIONS } from './data'
import { isMastered, stateOf } from './store'
import type { DomainId, Option, Question, QState, TopicId } from './types'

// ── deterministic randomness ───────────────────────────────────────────────
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffled<T>(items: T[], seed: number): T[] {
  const rnd = mulberry32(seed)
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Options in the display order the learner sees. Shuffling is seeded on the
 * question id plus how many times it has been attempted, so the order is
 * stable across re-renders but changes between attempts — otherwise the letter
 * gets memorised instead of the reasoning.
 */
export function displayOptions(q: Question, attempt: number, shuffle: boolean): Option[] {
  if (!shuffle) return q.options
  return shuffled(q.options, hash(q.id) + attempt * 7919)
}

// ── session building ───────────────────────────────────────────────────────
export type Pool = 'smart' | 'unseen' | 'wrong' | 'flagged' | 'due' | 'all'

export interface SessionFilter {
  topic?: TopicId | 'all'
  domain?: DomainId | 'all'
  service?: string
  pool?: Pool
  limit?: number
  onlyImportant?: boolean
}

function matches(q: Question, f: SessionFilter): boolean {
  if (f.topic && f.topic !== 'all' && q.topic !== f.topic) return false
  if (f.domain && f.domain !== 'all' && q.domain !== f.domain) return false
  if (f.service && !q.services.includes(f.service)) return false
  if (f.onlyImportant && !q.important) return false
  return true
}

function inPool(s: QState, pool: Pool, now: number): boolean {
  switch (pool) {
    case 'unseen': return s.seen === 0
    case 'wrong': return s.seen > 0 && !isMastered(s)
    case 'flagged': return !!s.flagged
    case 'due': return s.seen > 0 && s.due <= now
    default: return true
  }
}

/** How many questions each pool would yield for a filter — used for the counts
 *  next to the mode buttons. */
export function poolCounts(f: SessionFilter) {
  const now = Date.now()
  const base = QUESTIONS.filter((q) => matches(q, f))
  const count = (pool: Pool) => base.filter((q) => inPool(stateOf(q.id), pool, now)).length
  return {
    all: base.length,
    unseen: count('unseen'),
    wrong: count('wrong'),
    flagged: count('flagged'),
    due: count('due'),
  }
}

/**
 * Order for the "smart" pool: never-seen first, then the ones answered wrong,
 * then whatever is due for review, and mastered questions last.
 */
function priority(s: QState, now: number): number {
  if (s.seen === 0) return 0
  if (!s.lastOk) return 1
  if (!isMastered(s)) return 2
  if (s.due <= now) return 3
  return 4
}

export function buildSession(f: SessionFilter, seed = Date.now()): Question[] {
  const now = Date.now()
  const pool = f.pool ?? 'smart'
  const picked = QUESTIONS.filter(
    (q) => matches(q, f) && (pool === 'smart' || inPool(stateOf(q.id), pool, now)),
  )
  const mixed = shuffled(picked, seed)
  if (pool === 'smart') {
    mixed.sort((a, b) => priority(stateOf(a.id), now) - priority(stateOf(b.id), now))
  }
  return f.limit ? mixed.slice(0, f.limit) : mixed
}

/** The real exam is 65 questions weighted across the four domains. */
const EXAM_WEIGHTS: Record<DomainId, number> = {
  secure: 0.3, resilient: 0.26, performance: 0.24, cost: 0.2,
}

export function buildExam(size = 65, seed = Date.now()): Question[] {
  const out: Question[] = []
  const taken = new Set<string>()
  for (const [domain, weight] of Object.entries(EXAM_WEIGHTS) as [DomainId, number][]) {
    const want = Math.round(size * weight)
    const pool = shuffled(QUESTIONS.filter((q) => q.domain === domain), seed + hash(domain))
    for (const q of pool.slice(0, want)) {
      out.push(q)
      taken.add(q.id)
    }
  }
  // Top up (or trim) if rounding left the count off.
  const rest = shuffled(QUESTIONS.filter((q) => !taken.has(q.id)), seed + 1)
  while (out.length < size && rest.length) out.push(rest.pop() as Question)
  return shuffled(out.slice(0, size), seed + 2)
}

// ── stats ──────────────────────────────────────────────────────────────────
export interface Stats {
  total: number
  seen: number
  mastered: number
  answers: number
  correct: number
  accuracy: number
  due: number
  flagged: number
}

export function statsFor(questions: Question[]): Stats {
  const now = Date.now()
  let seen = 0, mastered = 0, answers = 0, correct = 0, due = 0, flagged = 0
  for (const q of questions) {
    const s = stateOf(q.id)
    if (s.seen > 0) seen++
    if (isMastered(s)) mastered++
    answers += s.seen
    correct += s.correct
    if (s.seen > 0 && s.due <= now && !isMastered(s)) due++
    if (s.flagged) flagged++
  }
  return {
    total: questions.length,
    seen, mastered, answers, correct, due, flagged,
    accuracy: answers ? correct / answers : 0,
  }
}

export function isAnswerCorrect(q: Question, picked: string[]): boolean {
  if (picked.length !== q.correct.length) return false
  return q.correct.every((l) => picked.includes(l))
}
