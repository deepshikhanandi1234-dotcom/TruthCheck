import { useState, useEffect, useRef, useCallback } from 'react'
import diyaImage from './assets/diya.webp'

const API_URL = import.meta.env.VITE_API_URL || 'https://truthcheck-backend-m5iq.onrender.com'

// Paste your /diya image base64 here when ready
const DIYA_IMG = diyaImage

const EXAMPLES = [
  "BREAKING: Scientists at Harvard confirm that 5G towers are secretly spreading a new virus to control the population. Anonymous whistleblower leaked classified documents proving government cover-up. Share before this gets deleted!",
  "The Federal Reserve held interest rates steady at their latest meeting, citing persistent inflation concerns. The unanimous decision aligned with most analyst expectations.",
  "Study shows coffee drinkers live 20% longer — experts say caffeine is the secret to immortality and doctors don't want you to know. Big Pharma is suppressing this information.",
]

const VERDICT_STYLES = {
  'Likely Real':  { pill: 'background:rgba(110,230,139,0.12);color:#6ee68b;border:1px solid rgba(110,230,139,0.3)', meter: '#6ee68b' },
  'Likely Fake':  { pill: 'background:rgba(255,77,77,0.12);color:#ff4d4d;border:1px solid rgba(255,77,77,0.3)',     meter: '#ff4d4d' },
  'Misleading':   { pill: 'background:rgba(255,179,71,0.12);color:#ffb347;border:1px solid rgba(255,179,71,0.3)',   meter: '#ffb347' },
  'Unverifiable': { pill: 'background:rgba(107,104,128,0.12);color:#888;border:1px solid rgba(107,104,128,0.3)',    meter: '#888' },
}

function LoadingCard({ msg }) {
  return (
    <div className="result-wrap visible">
      <div className="result-card">
        <div className="result-card-bar" />
        <div className="loading-state">
          <div className="spinner" />
          {msg}
        </div>
      </div>
    </div>
  )
}

function ErrorCard({ msg }) {
  return (
    <div className="result-wrap visible">
      <div className="result-card">
        <div className="result-card-bar" />
        <div className="loading-state" style={{ color: 'var(--red)' }}>{msg}</div>
      </div>
    </div>
  )
}

function ResultCard({ data }) {
  const [meterWidth, setMeterWidth] = useState(0)
  const conf = Math.min(100, Math.max(0, data.confidence))
  const vm = VERDICT_STYLES[data.verdict] || VERDICT_STYLES['Unverifiable']

  useEffect(() => {
    const t = setTimeout(() => setMeterWidth(conf), 60)
    return () => clearTimeout(t)
  }, [conf])

  return (
    <div className="result-wrap visible">
      <div className="result-card">
        <div className="result-card-bar" />

        <div className="verdict-top">
          <div>
            <span className="verdict-pill" style={{ cssText: vm.pill, ...parseStyle(vm.pill) }}>
              {data.verdict}
            </span>
            <div className="web-verified">VERIFIED WITH LIVE WEB SEARCH</div>
          </div>
          <div className="conf-block">
            <div className="conf-num" style={{ color: vm.meter }}>
              {conf}<span style={{ fontSize: '1.5rem', opacity: 0.4 }}>%</span>
            </div>
            <div className="conf-label">CONFIDENCE</div>
          </div>
        </div>

        <div className="meter">
          <div className="meter-fill" style={{ width: `${meterWidth}%`, background: vm.meter }} />
        </div>

        <div className="summary-block">{data.summary}</div>

        {data.signals?.length > 0 && (
          <>
            <div className="section-tag" style={{ marginBottom: '1rem' }}>Signal breakdown</div>
            <div className="signals-grid">
              {data.signals.map((s, i) => (
                <div className="signal-card" key={i}>
                  <div className="signal-top">
                    <span className="signal-name">{s.label}</span>
                    <span className={`signal-dot flag-${s.flag}`} />
                  </div>
                  <div className="signal-value">{s.value}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {data.sources?.length > 0 && (
          <div className="sources-section">
            <div className="sources-label">SOURCES CHECKED</div>
            {data.sources.map((s, i) => (
              <a className="source-link" key={i} href={s.url} target="_blank" rel="noopener noreferrer">
                <span className="source-title">{s.title}</span>
                {s.date && <span className="source-date">{s.date}</span>}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper: parse inline style string into React style object
function parseStyle(str) {
  const obj = {}
  str.split(';').forEach(rule => {
    const [k, v] = rule.split(':')
    if (k && v) {
      const key = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      obj[key] = v.trim()
    }
  })
  return obj
}

export default function App() {
  const [text, setText] = useState('')
  const [state, setState] = useState({ status: 'idle', data: null, msg: '' })
  const [diya, setDiya] = useState(false)
  const meterRef = useRef(null)

  // Easter egg
  useEffect(() => {
    if (text.trim() === '/diya') {
      setDiya(true)
      document.body.style.overflow = 'hidden'
    }
  }, [text])

  const closeDiya = useCallback(() => {
    setDiya(false)
    document.body.style.overflow = ''
    setText('')
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') closeDiya()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') analyze()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [text])

  const scrollToDetector = () =>
    document.getElementById('detector')?.scrollIntoView({ behavior: 'smooth' })

  const loadExample = () => {
    setText(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])
  }

  const useExample = (i) => {
    setText(EXAMPLES[i])
    scrollToDetector()
  }

  const analyze = async () => {
    const trimmed = text.trim()
    if (!trimmed || trimmed === '/diya') return

    setState({ status: 'loading', data: null, msg: 'Searching the web for current sources...' })

    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setState({ status: 'result', data, msg: '' })
    } catch (err) {
      console.error(err)
      setState({ status: 'error', data: null, msg: 'Analysis failed. Please try again.' })
    }
  }

  const isLoading = state.status === 'loading'

  return (
    <>
      {/* Animated background */}
      <div className="bg-mesh">
        <div className="blob blob1" />
        <div className="blob blob2" />
        <div className="blob blob3" />
      </div>
      <div className="scanlines" />

      {/* Nav */}
      <nav>
        <div className="logo">TruthCheck</div>
        <div className="nav-status">
          <div className="pulse-dot" />
          LIVE WEB SEARCH ACTIVE
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">MISINFORMATION DETECTION SYSTEM</div>
        <h1 className="hero-title">
          <span className="line1">DON'T</span>
          <span className="line2">BELIEVE</span>
          <span className="line1">EVERYTHING.</span>
        </h1>
        <p className="hero-sub">
          Paste any headline, article, or social post. Get an instant AI-powered credibility verdict backed by live web sources.
        </p>
        <div className="hero-cta">
          <button className="cta-btn" onClick={scrollToDetector}>
            <span>START CHECKING ↓</span>
          </button>
          <span className="scroll-hint">↓ scroll</span>
        </div>
      </section>

      {/* Ticker */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          {['VERIFY BEFORE YOU SHARE','LIVE WEB SEARCH','AI-POWERED ANALYSIS','SOURCE VERIFICATION','SIGNAL BREAKDOWN','FAKE NEWS DETECTION',
            'VERIFY BEFORE YOU SHARE','LIVE WEB SEARCH','AI-POWERED ANALYSIS','SOURCE VERIFICATION','SIGNAL BREAKDOWN','FAKE NEWS DETECTION']
            .map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      {/* Detector */}
      <section className="detector" id="detector">
        <div className="section-tag">Analyze content</div>

        <div className="detector-card">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste a headline, article excerpt, or social media post here..."
            rows={6}
          />
          <div className="input-footer">
            <span className="char-count">{text.length} character{text.length !== 1 ? 's' : ''}</span>
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={loadExample}>Load example</button>
              <button className="btn btn-main" onClick={analyze} disabled={isLoading || !text.trim()}>
                {isLoading ? 'Analyzing...' : 'Analyze →'}
              </button>
            </div>
          </div>
        </div>

        {/* Result area */}
        {state.status === 'loading' && <LoadingCard msg={state.msg} />}
        {state.status === 'error'   && <ErrorCard msg={state.msg} />}
        {state.status === 'result'  && <ResultCard data={state.data} />}

        {/* Example cards */}
        <div className="examples-section">
          <div className="section-tag">Try these examples</div>
          <div className="examples-grid">
            <div className="example-card" onClick={() => useExample(0)}>
              <span className="ex-tag ex-fake">● LIKELY FAKE</span>
              <p className="ex-text">BREAKING: Scientists confirm 5G towers spreading virus — whistleblower leaks classified documents. Share before deleted!</p>
            </div>
            <div className="example-card" onClick={() => useExample(1)}>
              <span className="ex-tag ex-real">● LIKELY REAL</span>
              <p className="ex-text">The Federal Reserve held interest rates steady, citing persistent inflation concerns after their latest policy meeting.</p>
            </div>
            <div className="example-card" onClick={() => useExample(2)}>
              <span className="ex-tag ex-mislead">● MISLEADING</span>
              <p className="ex-text">Study shows coffee drinkers live longer — experts say caffeine is the secret to immortality doctors don't want you knowing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-section">
        <div className="section-tag">How it works</div>
        <div className="steps">
          <div className="step">
            <div className="step-num">01</div>
            <div className="step-title">Paste content</div>
            <p className="step-desc">Submit any text — headline, article, tweet, or WhatsApp forward.</p>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <div className="step-title">AI analysis</div>
            <p className="step-desc">The AI searches the live web for current sources, then cross-checks the claim against real, up-to-date reporting.</p>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <div className="step-title">Get your verdict</div>
            <p className="step-desc">Receive a verdict with confidence score and a detailed signal-by-signal breakdown.</p>
          </div>
        </div>
      </section>

      {/* Easter egg overlay */}
      <div className={`diya-overlay${diya ? ' show' : ''}`} onClick={closeDiya}>
        {DIYA_IMG ? (
          <img src={DIYA_IMG} alt="diya" onClick={e => e.stopPropagation()} />
        ) : (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 260, height: 260, borderRadius: 20,
              background: 'var(--surface2)',
              border: '1px solid var(--border-bright)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'var(--muted)',
            }}
          >
            [ image goes here ]
          </div>
        )}
        <div className="diya-text">hehe gandu</div>
        <div className="diya-close">click anywhere to close</div>
      </div>
    </>
  )
}
