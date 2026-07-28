import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Explanation, TopicChips } from '../components/QuestionView'
import { Empty, Icon, Meter, PageTitle, pct } from '../components/ui'
import { buildDuels, commonPairs, myPairs } from '../lib/confusion'
import type { Pair } from '../lib/confusion'
import { isPairSettled, recordDuel, useStore } from '../lib/store'

/**
 * Duels: one scenario, two contenders, pick the right one.
 *
 * The pair list is mined from the learner's own wrong answers (see
 * confusion.ts), so the queue names the decision they actually get wrong
 * instead of the topic it belongs to. Stripping the question down to two
 * options is the point: it removes elimination as a strategy and forces the
 * distinction itself.
 */

function PairRow({ pair, mine, onPick }: { pair: Pair; mine: boolean; onPick: () => void }) {
  const store = useStore()
  const stat = store.duels[pair.id]
  const played = (stat?.won ?? 0) + (stat?.lost ?? 0)
  const settled = isPairSettled(stat)

  return (
    <button
      type="button"
      onClick={onPick}
      className="card group flex w-full flex-col p-4 text-left transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex-1 font-semibold leading-snug text-ink">
          {pair.a} <span className="text-muted">vs</span> {pair.b}
        </h3>
        {settled ? (
          <span className="chip shrink-0 bg-good-soft text-good-ink">resuelto</span>
        ) : mine ? (
          <span className="chip shrink-0 bg-critical-soft text-critical-ink">
            {pair.misses} {pair.misses === 1 ? 'fallo' : 'fallos'}
          </span>
        ) : (
          <span className="chip shrink-0">{pair.questions.length}</span>
        )}
      </div>

      <p className="mt-1.5 text-sm text-ink2">
        {pair.questions.length} {pair.questions.length === 1 ? 'pregunta' : 'preguntas'} los enfrentan
      </p>

      {played > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted">
              {stat.won} de {played} duelos
              {stat.streak > 0 && ` · racha ${stat.streak}`}
            </span>
            <span className="font-medium text-ink2">{pct(stat.won / played)}</span>
          </div>
          <Meter value={stat.won / played} label={`Acierto en ${pair.a} vs ${pair.b}`} />
        </div>
      )}
    </button>
  )
}

function Run({ pair, onExit }: { pair: Pair; onExit: () => void }) {
  const [seed, setSeed] = useState(() => Date.now())
  const duels = useMemo(() => buildDuels(pair.a, pair.b, seed), [pair.a, pair.b, seed])

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [tally, setTally] = useState({ right: 0, wrong: 0 })

  useEffect(() => {
    setIndex(0)
    setPicked(null)
    setTally({ right: 0, wrong: 0 })
  }, [pair.id, seed])

  const duel = duels[index]

  // Which contender sits on the left is seeded by the question id, so it is
  // stable while answering but not always the same side.
  const sides = useMemo(() => {
    if (!duel) return []
    const left = duel.q.num % 2 === 0
    return left ? [duel.right, duel.wrong] : [duel.wrong, duel.right]
  }, [duel])

  const choose = useCallback(
    (letter: string) => {
      if (picked || !duel) return
      const ok = letter === duel.right.letter
      setPicked(letter)
      setTally((t) => ({ right: t.right + (ok ? 1 : 0), wrong: t.wrong + (ok ? 0 : 1) }))
      recordDuel(pair.id, ok)
    },
    [picked, duel, pair.id],
  )

  const next = useCallback(() => {
    setPicked(null)
    setIndex((i) => i + 1)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!duel) return
      if (!picked && (e.key === '1' || e.key === '2')) {
        e.preventDefault()
        choose(sides[Number(e.key) - 1].letter)
      } else if (picked && e.key === 'Enter') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [duel, picked, sides, choose, next])

  const header = (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <button type="button" className="btn-quiet px-2.5 py-1.5 text-sm" onClick={onExit}>
        <Icon name="left" className="h-4 w-4" /> Todos los duelos
      </button>
      <p className="text-sm font-semibold text-ink">
        {pair.a} <span className="text-muted">vs</span> {pair.b}
      </p>
    </div>
  )

  if (!duel) {
    const total = tally.right + tally.wrong
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="swords" className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-ink">
            {total ? `${tally.right} de ${total}` : 'Duelo terminado'}
          </h1>
          <p className="mt-1 text-sm text-ink2">
            {total
              ? `${pct(tally.right / total)} de acierto distinguiendo ${pair.a} de ${pair.b}.`
              : 'No quedaban enfrentamientos para este par.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary" onClick={() => setSeed(Date.now())}>
              <Icon name="refresh" /> Otra ronda
            </button>
            <button type="button" className="btn-ghost" onClick={onExit}>
              Elegir otro par
            </button>
          </div>
        </div>
      </div>
    )
  }

  const ok = picked === duel.right.letter

  return (
    <>
      {header}

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted">
            {tally.right} aciertos · {tally.wrong} fallos
          </span>
          <span className="font-medium text-ink2">
            {index + 1} / {duels.length}
          </span>
        </div>
        <Meter value={index / duels.length} label="Avance del duelo" />
      </div>

      <article className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <TopicChips q={duel.q} />
        </div>

        <div className="px-5 py-6">
          <p className="max-w-reading whitespace-pre-line text-[15px] leading-relaxed text-ink">
            {duel.q.question}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {sides.map((side, i) => {
              const isRight = side.letter === duel.right.letter
              const chosen = picked === side.letter
              const tone = !picked
                ? 'border-line hover:border-accent hover:bg-raised'
                : isRight
                  ? 'border-good bg-good-soft'
                  : chosen
                    ? 'border-critical bg-critical-soft'
                    : 'border-line opacity-60'
              return (
                <button
                  key={side.letter}
                  type="button"
                  disabled={!!picked}
                  onClick={() => choose(side.letter)}
                  className={`rounded-xl border p-4 text-left transition-colors ${tone}`}
                >
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    {!picked && <span className="chip shrink-0">{i + 1}</span>}
                    {picked && (
                      <Icon
                        name={isRight ? 'check' : chosen ? 'x' : 'minus'}
                        className={`h-4 w-4 shrink-0 ${
                          isRight ? 'text-good-ink' : chosen ? 'text-critical-ink' : 'text-muted'
                        }`}
                      />
                    )}
                    {side.service}
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-ink2">{side.text}</span>
                </button>
              )
            })}
          </div>

          {!picked && (
            <p className="mt-4 text-center text-xs text-muted">
              Elige con el ratón o con las teclas 1 y 2
            </p>
          )}
        </div>

        {picked && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
            <p
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                ok ? 'bg-good-soft text-good-ink' : 'bg-critical-soft text-critical-ink'
              }`}
            >
              <Icon name={ok ? 'check' : 'x'} className="h-4 w-4" />
              {ok ? `Sí, ${duel.right.service}` : `Era ${duel.right.service}`}
            </p>
            <div className="flex items-center gap-2">
              <Link to={`/buscar?q=%23${duel.q.num}`} className="btn-quiet px-2.5 py-1.5 text-xs">
                Pregunta completa
              </Link>
              <button type="button" className="btn-primary" onClick={next} autoFocus>
                Siguiente <Icon name="right" />
              </button>
            </div>
          </div>
        )}
      </article>

      {picked && <Explanation q={duel.q} />}
    </>
  )
}

export default function Duels() {
  const [params, setParams] = useSearchParams()
  const store = useStore()

  const mine = useMemo(() => myPairs(), [store.q])
  const common = useMemo(() => {
    const taken = new Set(mine.map((p) => p.id))
    return commonPairs(24).filter((p) => !taken.has(p.id))
  }, [mine])

  const selectedId = params.get('par')
  const selected = useMemo(
    () => [...mine, ...common].find((p) => p.id === selectedId) ?? null,
    [mine, common, selectedId],
  )

  function open(pair: Pair | null) {
    const next = new URLSearchParams(params)
    pair ? next.set('par', pair.id) : next.delete('par')
    setParams(next)
  }

  if (selected) return <Run pair={selected} onExit={() => open(null)} />

  const pending = mine.filter((p) => !isPairSettled(store.duels[p.id]))
  const settled = mine.filter((p) => isPairSettled(store.duels[p.id]))

  return (
    <>
      <PageTitle
        title="Duelos"
        subtitle="Un escenario, dos candidatos, eliges cuál resuelve. Sin las otras opciones no puedes llegar por descarte: o conoces la diferencia o no."
      />

      {mine.length === 0 ? (
        <div className="mb-8">
          <Empty
            icon="swords"
            title="Aún no hay confusiones tuyas que mostrar"
            body="Los pares salen de las opciones incorrectas que eliges en Práctica y Simulacro. Responde unas cuantas y esta lista se llenará sola. Mientras tanto, aquí abajo están los pares que el banco enfrenta más veces."
          />
        </div>
      ) : (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Tus confusiones
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((p) => (
              <PairRow key={p.id} pair={p} mine onPick={() => open(p)} />
            ))}
          </div>

          {settled.length > 0 && (
            <>
              <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
                Resueltos · 4 aciertos seguidos
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {settled.map((p) => (
                  <PairRow key={p.id} pair={p} mine onPick={() => open(p)} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
          Pares frecuentes del banco
        </h2>
        <p className="mb-3 max-w-reading text-sm text-ink2">
          Las distinciones que más veces se enfrentan entre una respuesta correcta y un
          distractor, hayas fallado o no.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {common.map((p) => (
            <PairRow key={p.id} pair={p} mine={false} onPick={() => open(p)} />
          ))}
        </div>
      </section>

      <p className="mt-8 max-w-reading text-xs text-muted">
        Los duelos llevan su propio marcador y no cuentan para el dominio de cada pregunta:
        acertar entre dos opciones no es la misma prueba que resolver la pregunta completa con
        cuatro. Un par se marca como resuelto tras 4 aciertos seguidos.
      </p>
    </>
  )
}
