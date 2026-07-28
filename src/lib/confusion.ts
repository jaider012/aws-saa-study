import { QUESTIONS, REFINED } from './data'
import { hash, shuffled } from './session'
import { stateOf } from './store'
import type { Question } from './types'

/**
 * Confusion pairs, mined from your own wrong answers.
 *
 * Every wrong pick recorded by `recordAnswer` names an option letter. Each
 * option carries the services it mentions (`optionServices`, tagged at build
 * time), so a wrong pick tells us which service you reached for *instead of*
 * the right one. Counting those (right, wrong) pairs across the whole bank
 * gives an ordered list of the distinctions you actually get wrong — which is
 * a far better study queue than "topics you scored low in", because it names
 * the decision rather than the subject.
 *
 * The pair is unordered: confusing FSx for EFS and EFS for FSx is the same gap.
 */

export interface Pair {
  /** Stable id, the two service names sorted and joined. */
  id: string
  a: string
  b: string
  /** Times a question was answered wrong with these two services opposed. */
  misses: number
  /** Questions that can be drilled as a duel between these two. */
  questions: Question[]
}

/** A question reduced to one head-to-head: the right service vs a rival. */
export interface Duel {
  q: Question
  /** The correct option, and the distractor that names the rival service. */
  right: { letter: string; text: string; service: string }
  wrong: { letter: string; text: string; service: string }
}

function mostSpecific(names: string[]): string | undefined {
  return names.find((n) => REFINED.has(n)) ?? names[0]
}

function pairId(a: string, b: string) {
  return a < b ? `${a} vs ${b}` : `${b} vs ${a}`
}

/**
 * Every head-to-head a question can pose: for each correct option and each
 * distractor, the services that are exclusive to one side. Services present on
 * both sides are dropped — a question where every option says "Amazon S3"
 * teaches nothing about S3.
 */
function duelsIn(q: Question): { right: string; wrong: string; rightLetter: string; wrongLetter: string }[] {
  const out: { right: string; wrong: string; rightLetter: string; wrongLetter: string }[] = []
  for (const rl of q.correct) {
    const rs = q.optionServices?.[rl] ?? []
    if (!rs.length) continue
    for (const opt of q.options) {
      if (q.correct.includes(opt.letter)) continue
      const ws = q.optionServices?.[opt.letter] ?? []
      // One head-to-head per option pair: the most specific name on each side,
      // preferring a refined label ("Gateway endpoint") over the coarse bucket
      // it replaced ("VPC Endpoints"), since that is the real distinction.
      const right = mostSpecific(rs.filter((s) => !ws.includes(s)))
      const wrong = mostSpecific(ws.filter((s) => !rs.includes(s)))
      if (right && wrong) {
        out.push({ right, wrong, rightLetter: rl, wrongLetter: opt.letter })
      }
    }
  }
  return out
}

/** Questions that oppose these two services, in either direction. */
export function questionsForPair(a: string, b: string): Question[] {
  const want = pairId(a, b)
  return QUESTIONS.filter((q) =>
    duelsIn(q).some((d) => pairId(d.right, d.wrong) === want),
  )
}

/**
 * Turn a question into the single duel that opposes this pair. Returns null if
 * the question does not actually pit these two against each other.
 */
export function duelFor(q: Question, a: string, b: string): Duel | null {
  const want = pairId(a, b)
  const hit = duelsIn(q).find((d) => pairId(d.right, d.wrong) === want)
  if (!hit) return null
  const text = (letter: string) => q.options.find((o) => o.letter === letter)?.text ?? ''
  return {
    q,
    right: { letter: hit.rightLetter, text: text(hit.rightLetter), service: hit.right },
    wrong: { letter: hit.wrongLetter, text: text(hit.wrongLetter), service: hit.wrong },
  }
}

/**
 * Your confusion pairs, worst first. Only pairs you have actually got wrong
 * appear — this is a mirror, not a curriculum.
 */
export function myPairs(): Pair[] {
  const counts = new Map<string, { a: string; b: string; misses: number }>()

  for (const q of QUESTIONS) {
    const misses = stateOf(q.id).misses
    if (!misses) continue
    for (const d of duelsIn(q)) {
      const times = misses[d.wrongLetter] ?? 0
      if (!times) continue
      const id = pairId(d.right, d.wrong)
      const entry = counts.get(id) ?? { a: d.right, b: d.wrong, misses: 0 }
      entry.misses += times
      counts.set(id, entry)
    }
  }

  return [...counts.entries()]
    .map(([id, v]) => ({ id, ...v, questions: questionsForPair(v.a, v.b) }))
    .sort((x, y) => y.misses - x.misses || y.questions.length - x.questions.length)
}

/**
 * Pairs to practise before you have a miss history: the distinctions the bank
 * itself opposes most often. Used to seed the mode on a fresh profile so it is
 * not an empty screen.
 */
export function commonPairs(limit = 12): Pair[] {
  const counts = new Map<string, { a: string; b: string; n: number }>()
  for (const q of QUESTIONS) {
    const seen = new Set<string>()
    for (const d of duelsIn(q)) {
      const id = pairId(d.right, d.wrong)
      if (seen.has(id)) continue
      seen.add(id)
      const entry = counts.get(id) ?? { a: d.right, b: d.wrong, n: 0 }
      entry.n++
      counts.set(id, entry)
    }
  }
  return [...counts.entries()]
    .filter(([, v]) => v.n >= 3)
    .sort((x, y) => y[1].n - x[1].n)
    .slice(0, limit)
    .map(([id, v]) => ({ id, a: v.a, b: v.b, misses: 0, questions: questionsForPair(v.a, v.b) }))
}

/** The duel queue for one pair, shuffled but stable for a given seed. */
export function buildDuels(a: string, b: string, seed: number): Duel[] {
  const duels = questionsForPair(a, b)
    .map((q) => duelFor(q, a, b))
    .filter((d): d is Duel => d !== null)
  return shuffled(duels, seed + hash(pairId(a, b)))
}
