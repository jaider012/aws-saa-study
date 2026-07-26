import { Link } from 'react-router-dom'
import { domainName, topicName } from '../lib/data'
import type { Option, Question } from '../lib/types'
import { Chip, Icon } from './ui'

const LETTERS = 'ABCDEFG'

export function TopicChips({ q }: { q: Question }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link to={`/tema/${q.topic}`} className="chip hover:bg-line">
        <Icon name="layers" className="h-3.5 w-3.5" />
        {topicName(q.topic)}
      </Link>
      <Chip>{domainName(q.domain)}</Chip>
      {q.multi && <Chip>Varias respuestas</Chip>}
      {q.important && (
        <span className="chip border-warning bg-warning-soft text-warning-ink">
          <Icon name="star" className="h-3.5 w-3.5" filled />
          Destacada
        </span>
      )}
      <Chip title="Número de la pregunta en el material original">#{q.num}</Chip>
    </div>
  )
}

/**
 * One question with its options. `picked` and `q.correct` are always the
 * ORIGINAL letters from the source; `options` carries the display order, which
 * may be shuffled.
 */
export function QuestionView({
  q,
  options,
  picked,
  onPick,
  revealed,
  disabled,
  header,
  footer,
}: {
  q: Question
  options: Option[]
  picked: string[]
  onPick: (letter: string) => void
  revealed: boolean
  disabled?: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
}) {
  const needed = q.correct.length

  return (
    <article className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <TopicChips q={q} />
        {header}
      </div>

      <div className="px-5 py-5">
        <p className="max-w-reading whitespace-pre-line text-[15px] leading-relaxed text-ink">
          {q.question}
        </p>

        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">
          {needed > 1 ? `Elige ${needed} respuestas` : 'Elige 1 respuesta'}
        </p>

        <ul className="mt-3 space-y-2">
          {options.map((o, i) => (
            <li key={o.letter}>
              <OptionRow
                label={LETTERS[i]}
                option={o}
                picked={picked.includes(o.letter)}
                correct={q.correct.includes(o.letter)}
                revealed={revealed}
                disabled={disabled}
                multi={needed > 1}
                onPick={() => onPick(o.letter)}
              />
            </li>
          ))}
        </ul>
      </div>

      {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
    </article>
  )
}

function OptionRow({
  label,
  option,
  picked,
  correct,
  revealed,
  disabled,
  multi,
  onPick,
}: {
  label: string
  option: Option
  picked: boolean
  correct: boolean
  revealed: boolean
  disabled?: boolean
  multi: boolean
  onPick: () => void
}) {
  // Colour never carries the verdict alone: every revealed row also gets an
  // icon and a written label, because good/critical are not CVD-separable.
  let box = 'border-line bg-surface hover:bg-raised'
  let badge = 'border-rule text-ink2'
  let note: { icon: string; text: string; cls: string } | null = null

  if (revealed && correct) {
    box = 'border-good bg-good-soft'
    badge = 'border-good bg-good text-white'
    note = { icon: 'check', text: 'Correcta', cls: 'text-good-ink' }
  } else if (revealed && picked) {
    box = 'border-critical bg-critical-soft'
    badge = 'border-critical bg-critical text-white'
    note = { icon: 'x', text: 'Tu respuesta', cls: 'text-critical-ink' }
  } else if (revealed) {
    box = 'border-line bg-surface opacity-70'
  } else if (picked) {
    box = 'border-accent bg-accent-soft'
    badge = 'border-accent bg-accent text-white'
  }

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={picked}
      className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left
                  transition-colors focus-visible:outline focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-accent
                  disabled:cursor-default ${box}`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border
                    text-xs font-semibold ${badge} ${multi ? 'rounded-md' : 'rounded-full'}`}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-relaxed text-ink">{option.text}</span>
        {note && (
          <span className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${note.cls}`}>
            <Icon name={note.icon} className="h-3.5 w-3.5" />
            {note.text}
          </span>
        )}
      </span>
    </button>
  )
}

export function Verdict({ ok }: { ok: boolean }) {
  return ok ? (
    <p className="inline-flex items-center gap-2 rounded-xl bg-good-soft px-3 py-2 text-sm font-semibold text-good-ink">
      <Icon name="check" className="h-4 w-4" /> Correcto
    </p>
  ) : (
    <p className="inline-flex items-center gap-2 rounded-xl bg-critical-soft px-3 py-2 text-sm font-semibold text-critical-ink">
      <Icon name="x" className="h-4 w-4" /> Incorrecto
    </p>
  )
}

export function Explanation({ q }: { q: Question }) {
  const paragraphs = q.explanation ? q.explanation.split('\n\n').filter(Boolean) : []
  const answer = q.options.filter((o) => q.correct.includes(o.letter))

  return (
    <section className="card mt-4 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name="book" className="h-4 w-4 text-accent" />
        Por qué
      </h2>

      {/* The written rationale refers to options by their original letter, so
          show it here — the list above may be displayed in a shuffled order. */}
      <ul className="mt-3 space-y-2">
        {answer.map((o) => (
          <li key={o.letter} className="flex gap-2 text-sm text-ink">
            <span className="mt-0.5 text-good-ink">
              <Icon name="check" className="h-4 w-4" />
            </span>
            <span>
              <span className="font-semibold">{o.letter}.</span> {o.text}
            </span>
          </li>
        ))}
      </ul>

      {paragraphs.length > 0 ? (
        <div className="mt-4 max-w-reading space-y-3 border-t border-line pt-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-ink2">
              {p}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
          El material no incluye explicación escrita para esta pregunta.
        </p>
      )}

      {q.services.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
          {q.services.map((s) => (
            <Link key={s} to={`/buscar?servicio=${encodeURIComponent(s)}`} className="chip hover:bg-line">
              {s}
            </Link>
          ))}
        </div>
      )}

      {q.confidence !== 'high' && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-ink">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          La respuesta de esta pregunta se dedujo cruzando ambos documentos y no
          coincide palabra por palabra. Verifícala antes de darla por buena.
        </p>
      )}
    </section>
  )
}
