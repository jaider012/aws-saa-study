export type TopicId =
  | 's3' | 'storage' | 'compute' | 'network' | 'database' | 'security'
  | 'integration' | 'analytics' | 'management' | 'migration' | 'deployment'
  | 'ai' | 'cost'

export type DomainId = 'secure' | 'resilient' | 'performance' | 'cost'

export interface Option {
  letter: string
  text: string
}

export interface Question {
  id: string
  num: number
  question: string
  options: Option[]
  correct: string[]
  explanation: string
  multi: boolean
  important: boolean
  /** How the correct answer was established when the sources were joined. */
  confidence: 'high' | 'medium' | 'low'
  topic: TopicId
  domain: DomainId
  services: string[]
}

export interface Topic {
  id: TopicId
  name: string
  blurb: string
  count: number
}

export interface Domain {
  id: DomainId
  name: string
}

export interface Snippet {
  id: string
  topic: TopicId
  folder: string
  name: string
  lang: string
  code: string
}

/** Per-question progress; one IndexedDB record per question. */
export interface QState {
  seen: number
  correct: number
  /** Consecutive correct answers; 2 or more counts as mastered. */
  streak: number
  lastAt: number
  lastOk: boolean
  flagged?: boolean
  /** Lightweight SM-2 state used by the flashcard mode. */
  ease: number
  interval: number
  due: number
  reps: number
}

export interface ExamResult {
  at: number
  total: number
  correct: number
  seconds: number
  byDomain: Record<string, { total: number; correct: number }>
  byTopic: Record<string, { total: number; correct: number }>
  wrongIds: string[]
}

export interface Settings {
  shuffleOptions: boolean
  instantFeedback: boolean
}

export interface Store {
  version: 1
  q: Record<string, QState>
  exams: ExamResult[]
  settings: Settings
  lastTopic?: TopicId
}
