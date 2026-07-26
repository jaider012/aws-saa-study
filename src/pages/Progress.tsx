import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Meter, PageTitle, Stat, pct } from '../components/ui'
import { DOMAINS, QUESTIONS, TOPICS, byId, questionsByTopic, topicName } from '../lib/data'
import { statsFor } from '../lib/session'
import {
  exportProgress, importProgress, resetProgress, setSettings, stateOf, useStore,
} from '../lib/store'

export default function Progress() {
  const store = useStore()
  const overall = statsFor(QUESTIONS)
  const fileRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState('')

  const domainRows = DOMAINS.map((d) => {
    const qs = QUESTIONS.filter((q) => q.domain === d.id)
    return { ...d, stats: statsFor(qs) }
  })

  const attention = QUESTIONS.filter((q) => {
    const s = stateOf(q.id)
    return s.seen > 0 && s.streak === 0
  }).sort((a, b) => stateOf(b.id).lastAt - stateOf(a.id).lastAt)

  const flagged = QUESTIONS.filter((q) => stateOf(q.id).flagged)

  function download() {
    const blob = new Blob([exportProgress()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `saa-progreso-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function upload(file: File) {
    const ok = importProgress(await file.text())
    setNotice(ok ? 'Progreso importado.' : 'Ese archivo no tiene un progreso válido.')
  }

  return (
    <>
      <PageTitle
        title="Tu progreso"
        subtitle="Una pregunta cuenta como dominada tras dos aciertos seguidos."
      />

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Dominadas"
          value={overall.mastered}
          hint={`de ${overall.total} · ${pct(overall.mastered / overall.total)}`}
          tone="accent"
        />
        <Stat label="Respuestas" value={overall.answers} hint={`${overall.correct} correctas`} />
        <Stat
          label="Acierto global"
          value={overall.answers ? pct(overall.accuracy) : '—'}
          hint={overall.accuracy >= 0.72 ? 'por encima del aprobado' : 'el aprobado está en 72%'}
          tone={overall.answers ? (overall.accuracy >= 0.72 ? 'good' : 'critical') : 'plain'}
        />
        <Stat label="Marcadas" value={overall.flagged} hint="para volver a mirarlas" />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Por tema</h2>
        <ul className="card divide-y divide-line">
          {TOPICS.map((t) => {
            const s = statsFor(questionsByTopic[t.id])
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <Link to={`/tema/${t.id}`} className="w-52 shrink-0 truncate text-sm font-medium text-ink hover:underline">
                  {t.name}
                </Link>
                <div className="min-w-[8rem] flex-1">
                  <Meter value={s.total ? s.mastered / s.total : 0} label={`Dominadas en ${t.name}`} />
                </div>
                <span className="w-24 shrink-0 text-right text-sm tabular-nums text-ink2">
                  {s.mastered}/{s.total}
                </span>
                <span
                  className={`w-14 shrink-0 text-right text-sm tabular-nums ${
                    s.answers ? (s.accuracy >= 0.72 ? 'text-good-ink' : 'text-critical-ink') : 'text-muted'
                  }`}
                  title="Porcentaje de acierto"
                >
                  {s.answers ? pct(s.accuracy) : '—'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Por dominio del examen
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {domainRows.map((d) => (
            <Stat
              key={d.id}
              label={d.name}
              value={d.stats.answers ? pct(d.stats.accuracy) : '—'}
              hint={`${d.stats.mastered} de ${d.stats.total} dominadas`}
              tone={d.stats.answers ? (d.stats.accuracy >= 0.72 ? 'good' : 'critical') : 'plain'}
            />
          ))}
        </div>
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <QuestionList
          title={`Necesitan repaso (${attention.length})`}
          empty="Nada pendiente: no has fallado ninguna todavía."
          items={attention.slice(0, 30)}
        />
        <QuestionList
          title={`Marcadas (${flagged.length})`}
          empty="No has marcado ninguna pregunta."
          items={flagged.slice(0, 30)}
        />
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Ajustes y datos</h2>

        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            checked={store.settings.shuffleOptions}
            onChange={(e) => setSettings({ shuffleOptions: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-medium text-ink">Barajar las opciones</span>
            <span className="block text-xs text-ink2">
              Cambia el orden en cada intento, para que no memorices la letra en vez del razonamiento.
            </span>
          </span>
        </label>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
          <button type="button" className="btn-ghost" onClick={download}>
            Exportar progreso
          </button>
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Importar progreso
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn border border-critical text-critical-ink hover:bg-critical-soft"
            onClick={() => {
              if (confirm('Se borra todo tu progreso guardado. ¿Seguro?')) {
                resetProgress()
                setNotice('Progreso borrado.')
              }
            }}
          >
            Borrar todo
          </button>
        </div>

        {notice && <p className="mt-3 text-sm text-ink2">{notice}</p>}

        <p className="mt-4 text-xs text-muted">
          El progreso vive solo en este navegador (localStorage). Si cambias de equipo,
          expórtalo y vuelve a importarlo.
        </p>
      </section>
    </>
  )
}

function QuestionList({
  title, items, empty,
}: {
  title: string
  items: { id: string; num: number; question: string; topic: string }[]
  empty: string
}) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {items.length === 0 ? (
        <Empty title={empty} />
      ) : (
        <ul className="card max-h-96 divide-y divide-line overflow-auto">
          {items.map((q) => (
            <li key={q.id}>
              <Link
                to={`/buscar?q=${encodeURIComponent(`#${q.num}`)}`}
                className="block px-4 py-3 hover:bg-raised"
              >
                <span className="flex items-center gap-2 text-xs text-muted">
                  #{q.num}
                  <span className="truncate">{topicName(q.topic)}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-sm text-ink2">
                  {byId.get(q.id)?.question}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
