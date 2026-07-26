import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Icon } from './components/ui'
import Browse from './pages/Browse'
import Exam from './pages/Exam'
import Flashcards from './pages/Flashcards'
import Home from './pages/Home'
import Practice from './pages/Practice'
import Progress from './pages/Progress'
import Topic from './pages/Topic'
import { useHydrated } from './lib/store'

type Theme = 'light' | 'dark' | 'system'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('saa.theme') as Theme) || 'system',
  )
  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme
      localStorage.removeItem('saa.theme')
    } else {
      document.documentElement.dataset.theme = theme
      localStorage.setItem('saa.theme', theme)
    }
  }, [theme])
  return { theme, setTheme }
}

const NAV = [
  { to: '/', label: 'Temas', icon: 'home', end: true },
  { to: '/practica', label: 'Práctica', icon: 'bolt' },
  { to: '/flashcards', label: 'Tarjetas', icon: 'cards' },
  { to: '/simulacro', label: 'Simulacro', icon: 'clipboard' },
  { to: '/progreso', label: 'Progreso', icon: 'chart' },
  { to: '/buscar', label: 'Buscar', icon: 'search' },
]

function TopBar() {
  const { theme, setTheme } = useTheme()
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        <NavLink to="/" className="mr-2 flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
            <Icon name="layers" className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">SAA-C03</span>
        </NavLink>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent-soft text-accent' : 'text-ink2 hover:bg-raised'
                }`
              }
            >
              <Icon name={n.icon} className="h-4 w-4" />
              <span className="hidden md:inline">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="btn-quiet shrink-0 px-2.5 py-2"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title={dark ? 'Tema claro' : 'Tema oscuro'}
        >
          <Icon name={dark ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  )
}

function ScrollToTop() {
  const { pathname, search } = useLocation()
  // Block body on purpose: an effect must return a cleanup function or nothing,
  // and React would try to call whatever scrollTo returns.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname, search])
  return null
}

export default function App() {
  // Progress loads from IndexedDB asynchronously. Holding the routes back until
  // it lands avoids showing a page with zeroed-out stats, and guarantees no
  // component can write to the store before hydration has read it.
  const hydrated = useHydrated()

  return (
    <div className="min-h-full">
      <TopBar />
      <ScrollToTop />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!hydrated ? (
          <div className="flex items-center gap-3 py-16 text-sm text-muted" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
            Cargando tu progreso…
          </div>
        ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tema/:id" element={<Topic />} />
          <Route path="/practica" element={<Practice />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/simulacro" element={<Exam />} />
          <Route path="/progreso" element={<Progress />} />
          <Route path="/buscar" element={<Browse />} />
          <Route path="*" element={<Home />} />
        </Routes>
        )}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-2 text-xs text-muted">
        Banco de preguntas construido a partir de tu material de SAA-C03. Los
        enunciados y opciones están en inglés, como en el examen.
      </footer>
    </div>
  )
}
