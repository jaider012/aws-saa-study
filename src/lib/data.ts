import questionsJson from '../data/questions.json'
import topicsJson from '../data/topics.json'
import snippetsJson from '../data/snippets.json'
import type { Domain, Question, Snippet, Topic, TopicId } from './types'

export const QUESTIONS = questionsJson as Question[]
export const TOPICS = (topicsJson as { topics: Topic[] }).topics
export const DOMAINS = (topicsJson as { domains: Domain[] }).domains
export const SNIPPETS = snippetsJson as Snippet[]

export const byId = new Map(QUESTIONS.map((q) => [q.id, q]))

export const topicById = new Map(TOPICS.map((t) => [t.id, t]))
export const domainById = new Map(DOMAINS.map((d) => [d.id, d]))

export const questionsByTopic = TOPICS.reduce((acc, t) => {
  acc[t.id] = QUESTIONS.filter((q) => q.topic === t.id)
  return acc
}, {} as Record<TopicId, Question[]>)

export const snippetsByTopic = SNIPPETS.reduce((acc, s) => {
  ;(acc[s.topic] ||= []).push(s)
  return acc
}, {} as Record<string, Snippet[]>)

/** Every service tag in the bank, with how many questions mention it. */
export const serviceCounts = (() => {
  const m = new Map<string, number>()
  for (const q of QUESTIONS) for (const s of q.services) m.set(s, (m.get(s) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
})()

export function topicName(id: string) {
  return topicById.get(id as TopicId)?.name ?? id
}

export function domainName(id: string) {
  return domainById.get(id as Domain['id'])?.name ?? id
}
