import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error?: Error
  info?: ErrorInfo
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {}

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="renderer-error-screen">
        <h1>Renderer error</h1>
        <p>{this.state.error.message}</p>
        <pre>{this.state.error.stack}</pre>
        {this.state.info?.componentStack ? <pre>{this.state.info.componentStack}</pre> : null}
        <button type="button" onClick={() => location.reload()}>Reload</button>
        <button type="button" onClick={() => {
          localStorage.removeItem('codex3d-orchestrator-workspaces')
          location.reload()
        }}>Reset workspace layout</button>
      </div>
    )
  }
}
