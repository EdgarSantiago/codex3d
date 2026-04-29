import { useEffect, useRef, useState } from 'react'
import type { DevTerminal, Workspace } from '../../shared/types'
import { TerminalPane } from './TerminalPane'

type WorkspacePreviewPanelProps = {
  workspace?: Workspace
  previewUrl?: string
  devTerminals: DevTerminal[]
  activeDevTerminalId?: string
  devOutputByTerminal: Record<string, string>
  onSetPreviewUrl: (workspaceId: string, url: string) => void
  onCreateDevTerminal: () => Promise<void>
  onSelectDevTerminal: (terminalId: string) => void
  onCloseDevTerminal: (terminalId: string) => Promise<void>
  onSendDevInput: (terminalId: string, input: string) => void
  onResizeDevTerminal: (terminalId: string, cols: number, rows: number) => void
  onHide: () => void
}

export function WorkspacePreviewPanel({
  workspace,
  previewUrl,
  devTerminals,
  activeDevTerminalId,
  devOutputByTerminal,
  onSetPreviewUrl,
  onCreateDevTerminal,
  onSelectDevTerminal,
  onCloseDevTerminal,
  onSendDevInput,
  onResizeDevTerminal,
  onHide,
}: WorkspacePreviewPanelProps) {
  const [draftUrl, setDraftUrl] = useState(previewUrl ?? '')
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const activeTerminal = devTerminals.find(terminal => terminal.id === activeDevTerminalId) ?? devTerminals[0]

  useEffect(() => {
    setDraftUrl(previewUrl ?? '')
  }, [previewUrl, workspace?.id])

  function applyPreviewUrl() {
    if (!workspace) return
    onSetPreviewUrl(workspace.id, draftUrl)
  }

  return (
    <aside className="workspace-preview-panel">
      <section className="workspace-preview-section">
        <div className="workspace-preview-toolbar">
          <div className="workspace-preview-title-row">
            <div>
              <strong>Preview</strong>
              <span>{workspace?.name ?? 'No workspace'}</span>
            </div>
            <button type="button" className="workspace-preview-hide-button" onClick={onHide}>Hide</button>
          </div>
          <div className="workspace-preview-url-row">
            <input
              value={draftUrl}
              placeholder="http://localhost:5173"
              disabled={!workspace}
              onChange={event => setDraftUrl(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') applyPreviewUrl()
              }}
            />
            <button type="button" disabled={!workspace} onClick={applyPreviewUrl}>Load</button>
            <button type="button" disabled={!previewUrl} onClick={() => webviewRef.current?.reload()}>Reload</button>
          </div>
        </div>
        <div className="workspace-preview-frame-shell">
          {previewUrl ? (
            <webview ref={webviewRef} className="workspace-preview-webview" src={previewUrl} />
          ) : (
            <div className="workspace-preview-empty">
              Set a preview URL for this workspace.
            </div>
          )}
        </div>
      </section>

      <section className="dev-terminal-section">
        <div className="dev-terminal-header">
          <div>
            <strong>Dev terminals</strong>
            <span>Run commands in {workspace?.name ?? 'workspace'}</span>
          </div>
          <button type="button" disabled={!workspace} onClick={() => void onCreateDevTerminal()}>+ Terminal</button>
        </div>
        <div className="dev-terminal-tabs" role="tablist" aria-label="Dev terminals">
          {devTerminals.map(terminal => (
            <button
              key={terminal.id}
              type="button"
              role="tab"
              aria-selected={terminal.id === activeTerminal?.id}
              className={terminal.id === activeTerminal?.id ? 'active' : ''}
              onClick={() => onSelectDevTerminal(terminal.id)}
            >
              <span>{terminal.name}</span>
              <small>{terminal.status}</small>
              <span
                role="button"
                tabIndex={0}
                className="dev-terminal-close"
                onClick={event => {
                  event.stopPropagation()
                  void onCloseDevTerminal(terminal.id)
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    void onCloseDevTerminal(terminal.id)
                  }
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
        <div className="dev-terminal-body">
          <TerminalPane
            sessionId={activeTerminal?.id}
            output={activeTerminal ? devOutputByTerminal[activeTerminal.id] ?? '' : ''}
            emptyMessage="Create a dev terminal to run workspace commands."
            connectedMessage="Connected to dev terminal."
            onInput={input => {
              if (activeTerminal) onSendDevInput(activeTerminal.id, input)
            }}
            onResize={(cols, rows) => {
              if (activeTerminal) onResizeDevTerminal(activeTerminal.id, cols, rows)
            }}
          />
        </div>
      </section>
    </aside>
  )
}
