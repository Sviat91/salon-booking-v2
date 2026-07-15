"use client"
import { Component, ReactNode } from 'react'
import { clientLog } from '@/lib/client-logger'
import i18n from '@/lib/i18n'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    clientLog.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="max-w-md w-full bg-card rounded-2xl border border-border p-8 text-center">
            <div className="mb-4 text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-2">
              {i18n.t('errors.boundaryTitle')}
            </h1>
            <p className="text-muted dark:text-dark-muted mb-6">
              {i18n.t('errors.boundaryDesc')}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary w-full"
            >
              {i18n.t('errors.reload')}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
