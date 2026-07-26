import { Link } from 'react-router-dom'
import { Icon, Meter, PageTitle, Stat, pct } from '../components/ui'
import { QUESTIONS, TOPICS, questionsByTopic } from '../lib/data'
import { statsFor } from '../lib/session'
import { useStore } from '../lib/store'

export default function Home() {
  useStore() // re-render when progress changes
  const overall = statsFor(QUESTIONS)
  const dueTotal = TOPICS.reduce((n, t) => n + statsFor(questionsByTopic[t.id]).due, 0)

  return (
    <>
      <PageTitle
        title="Estudia por temas"
        subtitle={`${QUESTIONS.length} preguntas de examen agrupadas en ${TOPICS.length} temas, con las opciones reales y la explicación de la respuesta.`}
        right={
          <div className="flex gap-2">
            <Link to="/practica" className="btn-primary">
              <Icon name="bolt" /> Practicar todo
            </Link>
            <Link to="/simulacro" className="btn-ghost">
              <Icon name="clipboard" /> Simulacro
            </Link>
          </div>
        }
      />

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Dominadas"
          value={`${overall.mastered}`}
          hint={`de ${overall.total} · ${pct(overall.mastered / overall.total)}`}
          tone="accent"
        />
        <Stat
          label="Vistas"
          value={`${overall.seen}`}
          hint={`quedan ${overall.total - overall.seen} sin ver`}
        />
        <Stat
          label="Acierto"
          value={overall.answers ? pct(overall.accuracy) : '—'}
          hint={overall.answers ? `${overall.correct} de ${overall.answers} respuestas` : 'sin respuestas aún'}
          tone={overall.answers && overall.accuracy >= 0.72 ? 'good' : 'plain'}
        />
        <Stat
          label="Para repasar"
          value={`${dueTotal}`}
          hint="falladas o vencidas"
          tone={dueTotal > 0 ? 'critical' : 'plain'}
        />
      </section>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Temas</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => {
          const s = statsFor(questionsByTopic[t.id])
          const progress = s.total ? s.mastered / s.total : 0
          return (
            <Link
              key={t.id}
              to={`/tema/${t.id}`}
              className="card group flex flex-col p-4 transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug text-ink">{t.name}</h3>
                <span className="chip shrink-0">{t.count}</span>
              </div>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink2">{t.blurb}</p>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted">
                    {s.mastered} dominadas · {s.seen} vistas
                  </span>
                  <span className="font-medium text-ink2">{pct(progress)}</span>
                </div>
                <Meter value={progress} label={`Progreso de ${t.name}`} />
              </div>

              {s.due > 0 && (
                <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-critical-ink">
                  <Icon name="refresh" className="h-3.5 w-3.5" />
                  {s.due} para repasar
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
}
