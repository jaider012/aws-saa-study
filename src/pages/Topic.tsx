import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Chip, Empty, Icon, Meter, PageTitle, Stat, pct } from '../components/ui'
import { questionsByTopic, snippetsByTopic, topicById } from '../lib/data'
import { poolCounts, statsFor } from '../lib/session'
import { setLastTopic, useStore } from '../lib/store'
import type { TopicId } from '../lib/types'

export default function Topic() {
  const { id } = useParams<{ id: string }>()
  useStore()
  const topic = topicById.get(id as TopicId)
  const questions = topic ? questionsByTopic[topic.id] : []

  const services = useMemo(() => {
    const m = new Map<string, number>()
    for (const q of questions) for (const s of q.services) m.set(s, (m.get(s) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
  }, [questions])

  useEffect(() => {
    if (topic) setLastTopic(topic.id)
  }, [topic])

  if (!topic) {
    return <Empty title="Ese tema no existe" body="Vuelve al índice para elegir otro." />
  }

  const s = statsFor(questions)
  const pools = poolCounts({ topic: topic.id })
  const snippets = snippetsByTopic[topic.id] ?? []

  return (
    <>
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink2 hover:text-ink">
        <Icon name="left" className="h-4 w-4" /> Todos los temas
      </Link>

      <PageTitle title={topic.name} subtitle={topic.blurb} />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Preguntas" value={s.total} hint={`${s.seen} vistas`} />
        <Stat label="Dominadas" value={s.mastered} hint={pct(s.total ? s.mastered / s.total : 0)} tone="accent" />
        <Stat
          label="Acierto"
          value={s.answers ? pct(s.accuracy) : '—'}
          hint={s.answers ? `${s.correct}/${s.answers}` : 'sin datos'}
          tone={s.answers && s.accuracy >= 0.72 ? 'good' : 'plain'}
        />
        <Stat label="Para repasar" value={s.due} tone={s.due ? 'critical' : 'plain'} hint="falladas o vencidas" />
      </section>

      <div className="mb-8">
        <Meter value={s.total ? s.mastered / s.total : 0} label={`Progreso de ${topic.name}`} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Cómo estudiarlo</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ModeCard
          to={`/practica?tema=${topic.id}`}
          icon="bolt"
          title="Práctica"
          body="Opción múltiple con corrección y explicación al instante."
          badge={`${pools.all} preguntas`}
          primary
        />
        <ModeCard
          to={`/flashcards?tema=${topic.id}`}
          icon="cards"
          title="Tarjetas"
          body="Lee el escenario, responde de memoria y califícate. Repetición espaciada."
          badge={pools.due ? `${pools.due} vencidas` : 'sin vencidas'}
        />
        <ModeCard
          to={`/practica?tema=${topic.id}&modo=wrong`}
          icon="refresh"
          title="Repasar fallos"
          body="Solo las que aún no dominas, empezando por las más recientes."
          badge={`${pools.wrong} pendientes`}
          disabled={pools.wrong === 0}
        />
        <ModeCard
          to={`/practica?tema=${topic.id}&modo=unseen`}
          icon="layers"
          title="Nuevas"
          body="Las que todavía no has visto ni una vez."
          badge={`${pools.unseen} sin ver`}
          disabled={pools.unseen === 0}
        />
      </div>

      {services.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Servicios que aparecen
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {services.map(([name, n]) => (
              <Link
                key={name}
                to={`/practica?tema=${topic.id}&servicio=${encodeURIComponent(name)}`}
                className="chip hover:bg-line"
              >
                {name}
                <span className="text-muted">{n}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {snippets.length > 0 && <Snippets items={snippets} />}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Todas las preguntas del tema
        </h2>
        <ul className="card divide-y divide-line">
          {questions.map((q) => (
            <li key={q.id}>
              <Link
                to={`/buscar?q=${encodeURIComponent(`#${q.num}`)}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-raised"
              >
                <span className="mt-0.5 w-12 shrink-0 text-xs font-medium text-muted">#{q.num}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink2">{q.question}</span>
                {q.important && (
                  <span className="text-warning-ink" title="Destacada en el material">
                    <Icon name="star" className="h-3.5 w-3.5" filled />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function ModeCard({
  to, icon, title, body, badge, primary, disabled,
}: {
  to: string
  icon: string
  title: string
  body: string
  badge: string
  primary?: boolean
  disabled?: boolean
}) {
  const inner = (
    <>
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          primary ? 'bg-accent text-white' : 'bg-raised text-ink2'
        }`}
      >
        <Icon name={icon} />
      </span>
      <h3 className="mt-3 font-semibold text-ink">{title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-ink2">{body}</p>
      <span className="mt-3 text-xs font-medium text-muted">{badge}</span>
    </>
  )
  if (disabled) {
    return <div className="card flex cursor-not-allowed flex-col p-4 opacity-50">{inner}</div>
  }
  return (
    <Link to={to} className="card flex flex-col p-4 transition-colors hover:border-accent">
      {inner}
    </Link>
  )
}

function Snippets({ items }: { items: { id: string; name: string; folder: string; lang: string; code: string }[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <Icon name="terminal" className="h-4 w-4" />
        Laboratorios del curso
      </h2>
      <div className="card divide-y divide-line">
        {items.map((s) => (
          <div key={s.id}>
            <button
              type="button"
              onClick={() => setOpen(open === s.id ? null : s.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-raised"
              aria-expanded={open === s.id}
            >
              <Icon
                name="chevron"
                className={`h-4 w-4 shrink-0 text-muted transition-transform ${open === s.id ? 'rotate-90' : ''}`}
              />
              <span className="flex-1 truncate font-mono text-sm text-ink">{s.name}</span>
              <Chip>{s.folder}</Chip>
            </button>
            {open === s.id && (
              <pre className="max-h-96 overflow-auto border-t border-line bg-raised px-4 py-3 text-xs leading-relaxed text-ink2">
                <code>{s.code}</code>
              </pre>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
