import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Explanation, TopicChips } from '../components/QuestionView'
import { Empty, Icon, Meter, pct } from '../components/ui'
import { TOPICS, topicName } from '../lib/data'
import { buildSession } from '../lib/session'
import { gradeCard, toggleFlag, useStore } from '../lib/store'
import type { TopicId } from '../lib/types'

const GRADES = [
  { g: 0 as const, label: 'Otra vez', hint: 'hoy mismo', cls: 'border-critical text-critical-ink hover:bg-critical-soft' },
  { g: 1 as const, label: 'Difícil', hint: 'pronto', cls: 'border-warning text-warning-ink hover:bg-warning-soft' },
  { g: 2 as const, label: 'Bien', hint: 'unos días', cls: 'border-accent text-accent hover:bg-accent-soft' },
  { g: 3 as const, label: 'Fácil', hint: 'más tarde', cls: 'border-good text-good-ink hover:bg-good-soft' },
]

export default function Flashcards() {
  const [params, setParams] = useSearchParams()
  useStore()
  const topic = (params.get('tema') ?? 'all') as TopicId | 'all'
  const pool = params.get('modo') === 'todas' ? 'all' : 'smart'

  const [seed, setSeed] = useState(() => Date.now())
  const queue = useMemo(() => buildSession({ topic, pool }, seed), [topic, pool, seed])

  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(false)
  const [done, setDone] = useState(0)

  useEffect(() => {
    setIndex(0)
    setShown(false)
    setDone(0)
  }, [topic, pool, seed])

  const q = queue[index]

  const grade = useCallback(
    (g: 0 | 1 | 2 | 3) => {
      if (!q) return
      gradeCard(q.id, g)
      setDone((n) => n + 1)
      setShown(false)
      setIndex((i) => i + 1)
    },
    [q],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!q) return
      if (e.code === 'Space') {
        e.preventDefault()
        setShown(true)
      } else if (shown && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        grade((Number(e.key) - 1) as 0 | 1 | 2 | 3)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, shown, grade])

  function setTopic(value: string) {
    const next = new URLSearchParams(params)
    value === 'all' ? next.delete('tema') : next.set('tema', value)
    setParams(next)
  }

  const filters = (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <select className="field w-auto" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Tema">
        <option value="all">Todos los temas</option>
        {TOPICS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.count})
          </option>
        ))}
      </select>
      <p className="text-xs text-muted">Espacio revela · 1-4 califica</p>
    </div>
  )

  if (queue.length === 0) {
    return (
      <>
        {filters}
        <Empty title="No quedan tarjetas" body="Cambia de tema o vuelve más tarde, cuando toque repasar." />
      </>
    )
  }

  if (!q) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="cards" className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-ink">Mazo terminado</h1>
          <p className="mt-1 text-sm text-ink2">
            {done} tarjetas repasadas · {topic === 'all' ? 'todos los temas' : topicName(topic)}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary" onClick={() => setSeed(Date.now())}>
              <Icon name="refresh" /> Otro mazo
            </button>
            <Link to="/" className="btn-ghost">
              Volver a los temas
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {filters}

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted">{topic === 'all' ? 'Todos los temas' : topicName(topic)}</span>
          <span className="font-medium text-ink2">
            {index + 1} / {queue.length}
          </span>
        </div>
        <Meter value={index / queue.length} label="Avance del mazo" />
      </div>

      <article className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <TopicChips q={q} />
          <button
            type="button"
            onClick={() => toggleFlag(q.id)}
            className="btn-quiet px-2 py-1 text-xs"
            title="Marcar para revisar"
          >
            <Icon name="flag" className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-5 py-6">
          <p className="max-w-reading whitespace-pre-line text-[15px] leading-relaxed text-ink">
            {q.question}
          </p>

          {!shown && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-sm text-muted">
                Piensa qué servicio y qué configuración resuelven el escenario.
              </p>
              <button type="button" className="btn-primary" onClick={() => setShown(true)}>
                Revelar respuesta
              </button>
            </div>
          )}
        </div>

        {shown && (
          <div className="border-t border-line px-5 py-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
              ¿Qué tan bien lo sabías?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADES.map((g, i) => (
                <button
                  key={g.g}
                  type="button"
                  onClick={() => grade(g.g)}
                  className={`btn border bg-surface flex-col gap-0.5 py-2.5 ${g.cls}`}
                >
                  <span className="font-semibold">
                    {i + 1}. {g.label}
                  </span>
                  <span className="text-xs font-normal text-muted">{g.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </article>

      {shown && <Explanation q={q} />}

      {done > 0 && (
        <p className="mt-4 text-center text-xs text-muted">
          {done} repasadas en esta sesión ·{' '}
          {pct(index ? done / (index + 1) : 0)} del mazo recorrido
        </p>
      )}
    </>
  )
}
