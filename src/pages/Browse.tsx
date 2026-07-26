import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Explanation, QuestionView } from '../components/QuestionView'
import { Empty, Icon, PageTitle, pct } from '../components/ui'
import { QUESTIONS, TOPICS, serviceCounts, topicName } from '../lib/data'
import { isMastered } from '../lib/store'
import { stateOf, useStore } from '../lib/store'
import type { Question } from '../lib/types'

export default function Browse() {
  const [params, setParams] = useSearchParams()
  useStore()

  const query = params.get('q') ?? ''
  const topic = params.get('tema') ?? 'all'
  const service = params.get('servicio') ?? ''
  const [open, setOpen] = useState<string | null>(null)

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const results = useMemo(() => {
    const num = query.match(/^#?\s*(\d{1,3})$/)
    const needle = query.trim().toLowerCase()
    return QUESTIONS.filter((q) => {
      if (topic !== 'all' && q.topic !== topic) return false
      if (service && !q.services.includes(service)) return false
      if (!needle) return true
      if (num) return q.num === Number(num[1])
      return (
        q.question.toLowerCase().includes(needle) ||
        q.options.some((o) => o.text.toLowerCase().includes(needle)) ||
        q.services.some((s) => s.toLowerCase().includes(needle)) ||
        q.explanation.toLowerCase().includes(needle)
      )
    })
  }, [query, topic, service])

  return (
    <>
      <PageTitle
        title="Buscar en el banco"
        subtitle={`${results.length} de ${QUESTIONS.length} preguntas. Busca por texto, por servicio o escribe #124 para ir a una en concreto.`}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <Icon name="search" />
          </span>
          <input
            className="field pl-9"
            placeholder="cifrado en reposo, Aurora, #124…"
            value={query}
            onChange={(e) => update('q', e.target.value)}
            aria-label="Buscar preguntas"
          />
        </div>

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
          value={service}
          onChange={(e) => update('servicio', e.target.value)}
          aria-label="Servicio"
        >
          <option value="">Cualquier servicio</option>
          {serviceCounts.map(([name, n]) => (
            <option key={name} value={name}>
              {name} ({n})
            </option>
          ))}
        </select>
      </div>

      {results.length === 0 ? (
        <Empty
          icon="search"
          title="Nada coincide con esa búsqueda"
          body="Prueba con el nombre de un servicio, una palabra del enunciado o el número de pregunta."
        />
      ) : (
        <ul className="space-y-2">
          {results.slice(0, 120).map((q) => (
            <li key={q.id}>
              <Row q={q} open={open === q.id} onToggle={() => setOpen(open === q.id ? null : q.id)} />
            </li>
          ))}
        </ul>
      )}

      {results.length > 120 && (
        <p className="mt-4 text-center text-sm text-muted">
          Se muestran las primeras 120. Afina la búsqueda para ver el resto.
        </p>
      )}
    </>
  )
}

function Row({ q, open, onToggle }: { q: Question; open: boolean; onToggle: () => void }) {
  const s = stateOf(q.id)

  if (open) {
    return (
      <div>
        <QuestionView
          q={q}
          options={q.options}
          picked={[]}
          onPick={() => {}}
          revealed
          disabled
          header={
            <button type="button" className="btn-quiet px-2 py-1 text-xs" onClick={onToggle}>
              Cerrar
            </button>
          }
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>
                {s.seen > 0
                  ? `La has visto ${s.seen} ${s.seen === 1 ? 'vez' : 'veces'} · ${pct(s.correct / s.seen)} de acierto`
                  : 'Todavía no la has respondido'}
              </span>
              <Link to={`/practica?tema=${q.topic}`} className="btn-quiet text-xs">
                Practicar este tema <Icon name="right" className="h-3.5 w-3.5" />
              </Link>
            </div>
          }
        />
        <Explanation q={q} />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="card flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:border-accent"
    >
      <span className="mt-0.5 w-10 shrink-0 text-xs font-medium tabular-nums text-muted">#{q.num}</span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-sm text-ink">{q.question}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>{topicName(q.topic)}</span>
          {q.services.slice(0, 3).map((sv) => (
            <span key={sv} className="chip py-0.5">
              {sv}
            </span>
          ))}
        </span>
      </span>
      {isMastered(s) && (
        <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-good-ink" title="Dominada">
          <Icon name="check" className="h-3.5 w-3.5" />
          Dominada
        </span>
      )}
    </button>
  )
}
