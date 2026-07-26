import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Explanation, QuestionView, Verdict } from '../components/QuestionView'
import { Empty, Icon, Meter, pct } from '../components/ui'
import { TOPICS, topicName } from '../lib/data'
import { buildSession, displayOptions, isAnswerCorrect } from '../lib/session'
import type { Pool } from '../lib/session'
import { recordAnswer, stateOf, toggleFlag, useStore } from '../lib/store'
import type { TopicId } from '../lib/types'

const POOL_LABEL: Record<Pool, string> = {
  smart: 'orden inteligente',
  unseen: 'solo nuevas',
  wrong: 'solo falladas',
  flagged: 'solo marcadas',
  due: 'solo vencidas',
  all: 'todas',
}

export default function Practice() {
  const [params, setParams] = useSearchParams()
  const store = useStore()

  const topic = (params.get('tema') ?? 'all') as TopicId | 'all'
  const service = params.get('servicio') ?? undefined
  const pool = (params.get('modo') ?? 'smart') as Pool

  // The session is drawn once per filter change; answering must not reshuffle
  // the queue under the learner's feet.
  const [seed, setSeed] = useState(() => Date.now())
  const queue = useMemo(
    () => buildSession({ topic, service, pool }, seed),
    [topic, service, pool, seed],
  )

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [revealed, setRevealed] = useState(false)
  const [tally, setTally] = useState({ right: 0, wrong: 0 })
  const nextRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setIndex(0)
    setPicked([])
    setRevealed(false)
    setTally({ right: 0, wrong: 0 })
  }, [topic, service, pool, seed])

  const q = queue[index]
  // Frozen when the question appears: answering bumps `seen`, and recomputing
  // from it would reshuffle the options at the exact moment they are revealed.
  const attempt = useMemo(() => (q ? stateOf(q.id).seen : 0), [q?.id, index])
  const options = useMemo(
    () => (q ? displayOptions(q, attempt, store.settings.shuffleOptions) : []),
    [q, attempt, store.settings.shuffleOptions],
  )

  const pick = useCallback(
    (letter: string) => {
      if (revealed || !q) return
      setPicked((prev) => {
        if (q.correct.length === 1) return [letter]
        if (prev.includes(letter)) return prev.filter((l) => l !== letter)
        if (prev.length >= q.correct.length) return prev
        return [...prev, letter]
      })
    },
    [revealed, q],
  )

  const check = useCallback(() => {
    if (!q || revealed || picked.length !== q.correct.length) return
    const ok = isAnswerCorrect(q, picked)
    recordAnswer(q.id, ok)
    setTally((t) => ({ right: t.right + (ok ? 1 : 0), wrong: t.wrong + (ok ? 0 : 1) }))
    setRevealed(true)
  }, [q, revealed, picked])

  const next = useCallback(() => {
    setPicked([])
    setRevealed(false)
    setIndex((i) => i + 1)
  }, [])

  useEffect(() => {
    if (revealed) nextRef.current?.focus()
  }, [revealed])

  // Keyboard: number keys choose, Enter checks then advances, F flags.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!q) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key >= '1' && e.key <= '7') {
        const opt = options[Number(e.key) - 1]
        if (opt) {
          e.preventDefault()
          pick(opt.letter)
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        revealed ? next() : check()
      } else if (e.key.toLowerCase() === 'f') {
        toggleFlag(q.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, options, pick, check, next, revealed])

  const answered = tally.right + tally.wrong
  const filterLabel = [
    topic === 'all' ? 'Todos los temas' : topicName(topic),
    service,
    POOL_LABEL[pool],
  ]
    .filter(Boolean)
    .join(' · ')

  if (queue.length === 0) {
    return (
      <>
        <Filters params={params} setParams={setParams} />
        <Empty
          icon="check"
          title="No hay preguntas con ese filtro"
          body="Prueba con otro tema o cambia el modo — por ejemplo, si ya no te quedan falladas, es buena señal."
        />
      </>
    )
  }

  if (!q) {
    const accuracy = answered ? tally.right / answered : 0
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="check" className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-ink">Sesión terminada</h1>
          <p className="mt-1 text-sm text-ink2">{filterLabel}</p>

          <p className="mt-6 text-4xl font-semibold text-ink">{pct(accuracy)}</p>
          <p className="mt-1 text-sm text-ink2">
            {tally.right} correctas · {tally.wrong} falladas · {answered} respondidas
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary" onClick={() => setSeed(Date.now())}>
              <Icon name="refresh" /> Otra ronda
            </button>
            {tally.wrong > 0 && (
              <Link
                to={`/practica?${new URLSearchParams({
                  ...(topic !== 'all' ? { tema: topic } : {}),
                  modo: 'wrong',
                }).toString()}`}
                className="btn-ghost"
              >
                Repasar las falladas
              </Link>
            )}
            <Link to="/" className="btn-ghost">
              Volver a los temas
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const flagged = !!store.q[q.id]?.flagged
  const ok = revealed && isAnswerCorrect(q, picked)

  return (
    <>
      <Filters params={params} setParams={setParams} />

      <div className="mb-4 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="truncate text-muted">{filterLabel}</span>
            <span className="shrink-0 font-medium text-ink2">
              {index + 1} / {queue.length}
            </span>
          </div>
          <Meter value={(index + (revealed ? 1 : 0)) / queue.length} label="Avance de la sesión" />
        </div>
        {answered > 0 && (
          <p className="shrink-0 text-xs text-ink2">
            <span className="font-semibold text-good-ink">{tally.right}</span>
            <span className="text-muted"> / </span>
            <span className="font-semibold text-critical-ink">{tally.wrong}</span>
          </p>
        )}
      </div>

      <QuestionView
        q={q}
        options={options}
        picked={picked}
        onPick={pick}
        revealed={revealed}
        disabled={revealed}
        header={
          <button
            type="button"
            onClick={() => toggleFlag(q.id)}
            className={`btn-quiet px-2 py-1 text-xs ${flagged ? 'text-warning-ink' : ''}`}
            title="Marcar para revisar (tecla F)"
          >
            <Icon name="flag" className="h-3.5 w-3.5" filled={flagged} />
            {flagged ? 'Marcada' : 'Marcar'}
          </button>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {revealed ? <Verdict ok={ok} /> : <p className="text-xs text-muted">Teclas 1-{options.length} para elegir · Enter para comprobar</p>}
            {revealed ? (
              <button ref={nextRef} type="button" className="btn-primary" onClick={next}>
                {index + 1 === queue.length ? 'Ver resultado' : 'Siguiente'} <Icon name="right" />
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={check}
                disabled={picked.length !== q.correct.length}
              >
                Comprobar
              </button>
            )}
          </div>
        }
      />

      {revealed && <Explanation q={q} />}
    </>
  )
}

function Filters({
  params,
  setParams,
}: {
  params: URLSearchParams
  setParams: (p: URLSearchParams) => void
}) {
  const topic = params.get('tema') ?? 'all'
  const pool = params.get('modo') ?? 'smart'
  const service = params.get('servicio')

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (!value || value === 'all' || (key === 'modo' && value === 'smart')) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <select
        className="field w-auto"
        value={topic}
        onChange={(e) => update('tema', e.target.value)}
        aria-label="Tema"
      >
        <option value="all">Todos los temas</option>
        {TOPICS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.count})
          </option>
        ))}
      </select>

      <select
        className="field w-auto"
        value={pool}
        onChange={(e) => update('modo', e.target.value)}
        aria-label="Selección de preguntas"
      >
        <option value="smart">Orden inteligente</option>
        <option value="unseen">Solo nuevas</option>
        <option value="wrong">Solo falladas</option>
        <option value="due">Solo vencidas</option>
        <option value="flagged">Solo marcadas</option>
        <option value="all">Todas, al azar</option>
      </select>

      {service && (
        <button type="button" className="chip hover:bg-line" onClick={() => update('servicio', '')}>
          {service}
          <Icon name="x" className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
