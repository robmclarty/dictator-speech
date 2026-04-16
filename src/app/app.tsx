import { useEffect } from 'react'
import { installMotionCssVars } from '../theme/motion'
import { Controls } from './controls'
import { ErrorBoundary } from './error-boundary'
import { Footer } from './footer'
import { Portrait } from './portrait'
import { Teleprompter } from './teleprompter'

import './app.css'

export function App() {
  useEffect(() => {
    installMotionCssVars()
  }, [])

  return (
    <ErrorBoundary>
      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-title">Dictator Speech Generator</h1>
        </header>
        <main className="app-main">
          <Portrait />
          <Teleprompter />
        </main>
        <Controls />
        <Footer />
      </div>
    </ErrorBoundary>
  )
}
