import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ERROR_BODY, ERROR_HEADLINE, ERROR_RELOAD_LABEL } from './copy'
import { Footer } from './footer'

/**
 * The sole class component in the codebase, by constraint — React provides
 * no functional equivalent for componentDidCatch. The fallback render
 * intentionally imports nothing that could throw (no chunk corpus, no
 * storage hook). The "Resume" button reloads the page; that is the entire
 * recovery story for v1.
 */

interface Props {
  readonly children: ReactNode
}

interface State {
  readonly hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry by constraint; surface to the dev console only.
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }
    return (
      <div className="error-overlay" role="alertdialog" aria-modal="true" aria-labelledby="error-headline">
        <div className="error-card">
          <span className="error-ornament" aria-hidden="true">
            <svg width={24} height={24} viewBox="0 0 24 24" focusable="false">
              <path
                d="M12 2 14.9 8.6 22 9.5l-5.4 4.9L18.1 22 12 18.3 5.9 22l1.5-7.6L2 9.5l7.1-.9L12 2z"
                fill="var(--color-gold)"
                stroke="var(--color-ink)"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h2 id="error-headline" className="error-headline">
            {ERROR_HEADLINE}
          </h2>
          <p className="error-body">{ERROR_BODY}</p>
          <button type="button" className="primary-button" onClick={this.handleReload}>
            {ERROR_RELOAD_LABEL}
          </button>
        </div>
        <Footer />
      </div>
    )
  }
}
