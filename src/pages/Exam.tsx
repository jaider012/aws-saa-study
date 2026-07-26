import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Explanation, QuestionView, Verdict } from '../components/QuestionView'
import { Icon, Meter, PageTitle, Stat, pct } from '../components/ui'
import { DOMAINS, QUESTIONS, topicName } from '../lib/data'
import { buildExam, displayOptions, isAnswerCorrect } from '../lib/session'
import { recordAnswer, saveExam, useStore } from '../lib/store'
import type { ExamResult, Question } from '../lib/types'

const PASS = 0.72 // 720/1000 en la escala real del examen
const SIZES = [20, 40, 65]

type Phase = 'intro' | 'running' | 'done'

export default function Exam() {
  const store = useStore()
  const [phase, setPhase] = useState<Phase>('intro')
  const [size, setSize] = useState(65)
  const [seed, setSeed] = useState(() => Date.now())
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [left, setLeft] = useState(0)
  const [result, setResult] = useState<ExamResult | null>(null)

  const questions = useMemo(() => (phase === 'intro' ? [] : buildExam(size, seed)), [phase, size, seed])
  const seconds = size * 120 // 2 minutos por pregunta, como el examen real

  const finish = useCallback(
    (elapsed: number) => {
      const byDomain: ExamResult['byDomain'] = {}
      const byTopic: ExamResult['byTopic'] = {}
      const wrongIds: string[] = []
      let correct = 0

      for (const q of questions) {
        const picked = answers[q.id] ?? []
        const ok = picked.length > 0 && isAnswerCorrect(q, picked)
        if (ok) correct++
        else wrongIds.push(q.id)
        if (picked.length) recordAnswer(q.id, ok)

        const d = (byDomain[q.domain] ||= { total: 0, correct: 0 })
        d.total++
        if (ok) d.correct++
        const t = (byTopic[q.topic] ||= { total: 0, correct: 0 })
        t.total++
        if (ok) t.correct++
      }

      const res: ExamResult = {
        at: Date.now(), total: questions.length, correct,
        seconds: elapsed, byDomain, byTopic, wrongIds,
      }
      saveExam(res)
      setResult(res)
      setPhase('done')
    },
    [questions, answers],
  )

  // Countdown
  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase === 'running' && left === 0) finish(seconds)
  }, [phase, left, finish, seconds])

  function start() {
    setIndex(0)
    setAnswers({})
    setMarked(new Set())
    setLeft(seconds)
    setResult(null)
    setPhase('running')
  }

  // ── intro ────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    const history = store.exams
    return (
      <>
        <PageTitle
          title="Simulacro de examen"
          subtitle="Sin corrección hasta el final, con la mezcla de dominios del examen real y dos minutos por pregunta."
        />

        <div className="card max-w-2xl p-6">
          <p className="text-sm text-ink2">
            Se arman preguntas al azar del banco completo ({QUESTIONS.length} disponibles),
            repartidas como en el examen: 30% seguridad, 26% resiliencia, 24% rendimiento y
            20% costos. Aprobado a partir del {pct(PASS)}.
          </p>

          <fieldset className="mt-6">
            <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Cuántas preguntas
            </legend>
            <div className="flex gap-2">
              {SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSize(n)}
                  className={`btn border ${
                    size === n ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink2'
                  }`}
                >
                  {n} preguntas
                  <span className="text-xs text-muted">{Math.round((n * 120) / 60)} min</span>
                </button>
              ))}
            </div>
          </fieldset>

          <button type="button" className="btn-primary mt-6" onClick={start}>
            <Icon name="clipboard" /> Empezar simulacro
          </button>
        </div>

        {history.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Intentos anteriores
            </h2>
            <ul className="card divide-y divide-line">
              {history.map((e) => {
                const score = e.correct / e.total
                return (
                  <li key={e.at} className="flex items-center gap-4 px-4 py-3">
                    <span className="w-28 shrink-0 text-sm text-ink2">
                      {new Date(e.at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className="flex-1 text-sm text-muted">
                      {e.correct} / {e.total} · {Math.round(e.seconds / 60)} min
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                        score >= PASS ? 'text-good-ink' : 'text-critical-ink'
                      }`}
                    >
                      <Icon name={score >= PASS ? 'check' : 'x'} className="h-4 w-4" />
                      {pct(score)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </>
    )
  }

  // ── results ──────────────────────────────────────────────────────────────
  if (phase === 'done' && result) {
    return <Results result={result} questions={questions} answers={answers} onRestart={() => { setSeed(Date.now()); setPhase('intro') }} />
  }

  // ── running ──────────────────────────────────────────────────────────────
  const q = questions[index]
  const picked = answers[q.id] ?? []
  const answeredCount = Object.values(answers).filter((a) => a.length).length

  function pick(letter: string) {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? []
      let next: string[]
      if (q.correct.length === 1) next = [letter]
      else if (cur.includes(letter)) next = cur.filter((l) => l !== letter)
      else if (cur.length >= q.correct.length) next = cur
      else next = [...cur, letter]
      return { ...prev, [q.id]: next }
    })
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold tabular-nums ${
              left < 300 ? 'bg-critical-soft text-critical-ink' : 'bg-raised text-ink2'
            }`}
          >
            <Icon name="clock" className="h-4 w-4" />
            {mm}:{ss}
          </span>
          <span className="text-sm text-ink2">
            {answeredCount} de {questions.length} respondidas
          </span>
        </div>
        <button type="button" className="btn-ghost" onClick={() => finish(seconds - left)}>
          Finalizar y corregir
        </button>
      </div>

      <div className="mb-5">
        <Meter value={answeredCount / questions.length} label="Preguntas respondidas" />
      </div>

      <QuestionView
        q={q}
        options={displayOptions(q, 0, store.settings.shuffleOptions)}
        picked={picked}
        onPick={pick}
        revealed={false}
        header={
          <button
            type="button"
            className={`btn-quiet px-2 py-1 text-xs ${marked.has(q.id) ? 'text-warning-ink' : ''}`}
            onClick={() =>
              setMarked((prev) => {
                const next = new Set(prev)
                next.has(q.id) ? next.delete(q.id) : next.add(q.id)
                return next
              })
            }
          >
            <Icon name="flag" className="h-3.5 w-3.5" filled={marked.has(q.id)} />
            {marked.has(q.id) ? 'Marcada' : 'Marcar'}
          </button>
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              <Icon name="left" /> Anterior
            </button>
            <span className="text-xs text-muted">
              {index + 1} / {questions.length}
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={index === questions.length - 1}
            >
              Siguiente <Icon name="right" />
            </button>
          </div>
        }
      />

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Navegación</h2>
        <div className="flex flex-wrap gap-1.5">
          {questions.map((item, i) => {
            const done = (answers[item.id] ?? []).length > 0
            const isMarked = marked.has(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ir a la pregunta ${i + 1}${done ? ', respondida' : ''}${isMarked ? ', marcada' : ''}`}
                aria-current={i === index}
                className={`relative h-8 w-8 rounded-lg border text-xs font-medium tabular-nums transition-colors ${
                  i === index
                    ? 'border-accent bg-accent text-white'
                    : done
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-surface text-muted hover:bg-raised'
                }`}
              >
                {i + 1}
                {isMarked && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warning" />
                )}
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}

function Results({
  result, questions, answers, onRestart,
}: {
  result: ExamResult
  questions: Question[]
  answers: Record<string, string[]>
  onRestart: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const score = result.correct / result.total
  const passed = score >= PASS
  const listed = showAll ? questions : questions.filter((q) => result.wrongIds.includes(q.id))

  return (
    <>
      <div className="card mb-6 p-8 text-center">
        <span
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            passed ? 'bg-good-soft text-good-ink' : 'bg-critical-soft text-critical-ink'
          }`}
        >
          <Icon name={passed ? 'check' : 'x'} className="h-7 w-7" />
        </span>
        <p className="mt-4 text-5xl font-semibold text-ink">{pct(score)}</p>
        <p className={`mt-2 text-sm font-semibold ${passed ? 'text-good-ink' : 'text-critical-ink'}`}>
          {passed ? 'Aprobado' : 'No aprobado'} · mínimo {pct(PASS)}
        </p>
        <p className="mt-1 text-sm text-ink2">
          {result.correct} de {result.total} correctas en {Math.round(result.seconds / 60)} minutos
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={onRestart}>
            <Icon name="refresh" /> Otro simulacro
          </button>
          <Link to="/progreso" className="btn-ghost">
            Ver progreso
          </Link>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Por dominio</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DOMAINS.filter((d) => result.byDomain[d.id]).map((d) => {
            const b = result.byDomain[d.id]
            return (
              <Stat
                key={d.id}
                label={d.name}
                value={pct(b.correct / b.total)}
                hint={`${b.correct} de ${b.total}`}
                tone={b.correct / b.total >= PASS ? 'good' : 'critical'}
              />
            )
          })}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Por tema</h2>
        <ul className="card divide-y divide-line">
          {Object.entries(result.byTopic)
            .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
            .map(([topic, b]) => (
              <li key={topic} className="flex items-center gap-4 px-4 py-3">
                <Link to={`/tema/${topic}`} className="w-56 shrink-0 truncate text-sm text-ink hover:underline">
                  {topicName(topic)}
                </Link>
                <div className="min-w-0 flex-1">
                  <Meter value={b.correct / b.total} label={topicName(topic)} />
                </div>
                <span className="w-20 shrink-0 text-right text-sm tabular-nums text-ink2">
                  {b.correct}/{b.total}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {showAll ? 'Todas las preguntas' : `Las ${result.wrongIds.length} que fallaste`}
          </h2>
          <button type="button" className="btn-quiet text-xs" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Ver solo las falladas' : 'Ver todas'}
          </button>
        </div>
        <div className="space-y-6">
          {listed.map((q) => {
            const picked = answers[q.id] ?? []
            return (
              <div key={q.id}>
                <QuestionView
                  q={q}
                  options={q.options}
                  picked={picked}
                  onPick={() => {}}
                  revealed
                  disabled
                  footer={
                    picked.length ? (
                      <Verdict ok={isAnswerCorrect(q, picked)} />
                    ) : (
                      <p className="text-sm text-muted">Sin responder</p>
                    )
                  }
                />
                <Explanation q={q} />
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
