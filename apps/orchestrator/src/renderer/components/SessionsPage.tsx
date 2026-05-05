import { useCallback, useEffect, useState } from 'react'
import type { AgentProvider, AgentSession, DevTerminal, Workspace } from '../../shared/types'
import type { TerminalLayoutNode, TerminalSplitOrientation } from '../stores/appStore'
import { TerminalTabBar, type TabContextMenuRequest } from './TerminalTabBar'
import { TerminalView } from './TerminalView'
import { WorkspacePreviewPanel } from './WorkspacePreviewPanel'

type SessionsPageProps = {
  workspaces: Workspace[]
  activeWorkspaceId?: string
  onSelectWorkspace: (workspaceId: string) => void
  onCloseWorkspace: (workspaceId: string) => Promise<void>
  onAddWorkspace: () => Promise<void>
  onOpenWorkspaceInVSCode: (path: string) => Promise<void>
  sessions: AgentSession[]
  workspaceCompletionCounts: Record<string, number>
  selectedSessionId?: string
  outputBySession: Record<string, string>
  terminalLayout: TerminalLayoutNode
  activePaneId: string
  onSelectSession: (sessionId: string) => void
  onSelectPane: (paneId: string) => void
  onSelectPaneSession: (paneId: string, sessionId: string) => void
  onSplitPane: (paneId: string, orientation: TerminalSplitOrientation) => void
  onResizeSplit: (splitId: string, sizes: number[]) => void
  onMoveSessionToPane: (sessionId: string, targetPaneId: string) => void
  onClosePane: (paneId: string) => void
  onLaunchSession: (provider: AgentProvider) => Promise<void>
  onRestartSession: (sessionId: string) => Promise<void>
  onStopSession: (sessionId: string) => Promise<void>
  onCloseSession: (sessionId: string) => Promise<void>
  onRenameSession: (sessionId: string, name: string) => void
  onSendInput: (sessionId: string, input: string) => Promise<void>
  onResizeTerminal: (sessionId: string, cols: number, rows: number) => void
  devTerminals: DevTerminal[]
  activeDevTerminalId?: string
  devOutputByTerminal: Record<string, string>
  previewUrl?: string
  previewPanelWidth?: number
  previewPanelHidden: boolean
  providerOptions: ProviderOption[]
  onSetPreviewUrl: (workspaceId: string, url: string) => void
  onSetPreviewPanelWidth: (width: number) => void
  onSetPreviewPanelHidden: (hidden: boolean) => void
  onCreateDevTerminal: () => Promise<void>
  onSelectDevTerminal: (terminalId: string) => void
  onCloseDevTerminal: (terminalId: string) => Promise<void>
  onSendDevInput: (terminalId: string, input: string) => void
  onResizeDevTerminal: (terminalId: string, cols: number, rows: number) => void
}

export type ProviderOption = {
  provider: AgentProvider
  label: string
  found: boolean
  detail?: string
}

export function SessionsPage({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCloseWorkspace,
  onAddWorkspace,
  onOpenWorkspaceInVSCode,
  sessions,
  workspaceCompletionCounts,
  selectedSessionId,
  outputBySession,
  terminalLayout,
  activePaneId,
  onSelectSession,
  onSelectPane,
  onSelectPaneSession,
  onSplitPane,
  onResizeSplit,
  onMoveSessionToPane,
  onClosePane,
  onLaunchSession,
  onRestartSession,
  onStopSession,
  onCloseSession,
  onRenameSession,
  onSendInput,
  onResizeTerminal,
  devTerminals,
  activeDevTerminalId,
  devOutputByTerminal,
  previewUrl,
  previewPanelWidth,
  previewPanelHidden,
  providerOptions,
  onSetPreviewUrl,
  onSetPreviewPanelWidth,
  onSetPreviewPanelHidden,
  onCreateDevTerminal,
  onSelectDevTerminal,
  onCloseDevTerminal,
  onSendDevInput,
  onResizeDevTerminal,
}: SessionsPageProps) {
  const [busy, setBusy] = useState(false)
  const [pendingRenameSession, setPendingRenameSession] = useState<AgentSession | undefined>()
  const [tabMenu, setTabMenu] = useState<TabContextMenuRequest | undefined>()
  const [renameValue, setRenameValue] = useState('')
  const [pendingCloseSession, setPendingCloseSession] = useState<AgentSession | undefined>()
  const [pendingClosePaneId, setPendingClosePaneId] = useState<string | undefined>()
  const [pendingCloseWorkspace, setPendingCloseWorkspace] = useState<Workspace | undefined>()
  const [launchProvider, setLaunchProvider] = useState<AgentProvider>('codex3d')
  const [launchModalOpen, setLaunchModalOpen] = useState(false)

  useEffect(() => {
    const firstSessionId = sessions[0]?.id
    if (!firstSessionId || selectedSessionId === firstSessionId) return
    const selectedBelongsToWorkspace = selectedSessionId ? sessions.some(session => session.id === selectedSessionId) : false
    if (!selectedBelongsToWorkspace) {
      onSelectSession(firstSessionId)
    }
  }, [onSelectSession, selectedSessionId, sessions])

  const openLaunchModal = useCallback(() => {
    setLaunchProvider(providerOptions.find(option => option.provider === launchProvider)?.provider ?? providerOptions[0]?.provider ?? 'codex3d')
    setLaunchModalOpen(true)
  }, [launchProvider, providerOptions])

  const launchSession = useCallback(async () => {
    setBusy(true)
    try {
      await onLaunchSession(launchProvider)
      setLaunchModalOpen(false)
    } finally {
      setBusy(false)
    }
  }, [launchProvider, onLaunchSession])

  const restartSession = useCallback(async (sessionId?: string) => {
    if (!sessionId) return
    setBusy(true)
    try {
      await onRestartSession(sessionId)
    } finally {
      setBusy(false)
    }
  }, [onRestartSession])

  const stopSession = useCallback(async (sessionId?: string) => {
    if (!sessionId) return
    setBusy(true)
    try {
      await onStopSession(sessionId)
    } finally {
      setBusy(false)
    }
  }, [onStopSession])

  const closePendingSession = useCallback(async () => {
    if (!pendingCloseSession) return
    setBusy(true)
    try {
      await onCloseSession(pendingCloseSession.id)
      setPendingCloseSession(undefined)
    } finally {
      setBusy(false)
    }
  }, [onCloseSession, pendingCloseSession])

  const renamePendingSession = useCallback(() => {
    if (!pendingRenameSession) return
    const nextName = renameValue.trim()
    if (nextName) onRenameSession(pendingRenameSession.id, nextName)
    setPendingRenameSession(undefined)
    setRenameValue('')
  }, [onRenameSession, pendingRenameSession, renameValue])

  const closePendingPane = useCallback(() => {
    if (!pendingClosePaneId) return
    onClosePane(pendingClosePaneId)
    setPendingClosePaneId(undefined)
  }, [onClosePane, pendingClosePaneId])

  const closePendingWorkspace = useCallback(async () => {
    if (!pendingCloseWorkspace) return
    setBusy(true)
    try {
      await onCloseWorkspace(pendingCloseWorkspace.id)
      setPendingCloseWorkspace(undefined)
    } finally {
      setBusy(false)
    }
  }, [onCloseWorkspace, pendingCloseWorkspace])

  const sessionsById = new Map(sessions.map(session => [session.id, session]))
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId)
  const workspacePath = formatWorkspacePath(activeWorkspace?.path)

  return (
    <div className="sessions-shell">
      <div className="sessions-workspace-switcher">
        <div className="workspace-chip-row" aria-label="Workspace switcher">
          {workspaces.map(workspace => (
            <span
              key={workspace.id}
              className={`workspace-chip ${workspace.id === activeWorkspaceId ? 'active' : ''}`}
              title={workspace.path}
            >
              <button
                type="button"
                className="workspace-chip-select"
                onClick={() => onSelectWorkspace(workspace.id)}
              >
                {workspace.name}
                {workspaceCompletionCounts[workspace.id] ? <span className="workspace-chip-count">({workspaceCompletionCounts[workspace.id]})</span> : null}
              </button>
              <button
                type="button"
                className="workspace-chip-close"
                aria-label={`Close workspace ${workspace.name}`}
                title={`Close workspace ${workspace.name}`}
                onClick={event => {
                  event.stopPropagation()
                  setPendingCloseWorkspace(workspace)
                }}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="workspace-chip add" aria-label="Add workspace" title="Add workspace" onClick={() => void onAddWorkspace()}>+</button>
        </div>
        <div className="workspace-header-row">
          <span title={activeWorkspace?.path}>
            {workspacePath ? (
              <>
                {workspacePath.parent}<b className="workspace-path-leaf">{workspacePath.leaf}</b>
              </>
            ) : 'No workspace selected'}
          </span>
          <button
            type="button"
            className="workspace-preview-show-button"
            disabled={!activeWorkspace}
            onClick={() => onSetPreviewPanelHidden(!previewPanelHidden)}
          >
            {previewPanelHidden ? 'Show Preview' : 'Hide Preview'}
          </button>
          <button
            type="button"
            className="workspace-open-code-button"
            disabled={!activeWorkspace}
            onClick={() => {
              if (activeWorkspace) void onOpenWorkspaceInVSCode(activeWorkspace.path)
            }}
          >
            Open in VS Code
          </button>
        </div>
      </div>

      {activeWorkspace ? (
        <div
          className={`workspace-main-layout ${previewPanelHidden ? 'preview-hidden' : ''}`}
          aria-busy={busy}
          style={{ gridTemplateColumns: previewPanelHidden ? 'minmax(0, 1fr)' : `minmax(0, 1fr) 8px ${previewPanelWidth ?? 420}px` }}
        >
        <div className="workspace-agent-area">
          <div className="tabbed-sessions-page">
            <SplitNodeView
              node={terminalLayout}
              sessionsById={sessionsById}
              outputBySession={outputBySession}
              activePaneId={activePaneId}
              onSelectPane={onSelectPane}
              onSelectSession={onSelectSession}
              onSelectPaneSession={onSelectPaneSession}
              onSplitPane={onSplitPane}
              onResizeSplit={onResizeSplit}
              onMoveSessionToPane={onMoveSessionToPane}
              onClosePane={setPendingClosePaneId}
              onRequestCloseSession={session => {
                setPendingCloseSession(session)
              }}
              onRequestTabMenu={request => setTabMenu(request)}
              onLaunchSession={openLaunchModal}
              onRestartSession={restartSession}
              onStopSession={stopSession}
              onSendInput={onSendInput}
              onResizeTerminal={onResizeTerminal}
              providerOptions={providerOptions}
            />
          </div>
        </div>
        {previewPanelHidden ? null : (
          <>
            <div
              className="workspace-right-resize-handle"
              role="separator"
              aria-orientation="vertical"
              onPointerDown={event => startRightPanelResize(event, onSetPreviewPanelWidth)}
              onDoubleClick={() => onSetPreviewPanelWidth(420)}
            />
            <WorkspacePreviewPanel
          workspace={activeWorkspace}
          previewUrl={previewUrl}
          devTerminals={devTerminals}
          activeDevTerminalId={activeDevTerminalId}
          devOutputByTerminal={devOutputByTerminal}
          onSetPreviewUrl={onSetPreviewUrl}
          onCreateDevTerminal={onCreateDevTerminal}
          onSelectDevTerminal={onSelectDevTerminal}
          onCloseDevTerminal={onCloseDevTerminal}
          onSendDevInput={onSendDevInput}
          onResizeDevTerminal={onResizeDevTerminal}
          onHide={() => onSetPreviewPanelHidden(true)}
        />
          </>
        )}
        </div>
      ) : (
        <div className="no-workspace-empty-state">
          <div className="empty-terminal-glyph">+</div>
          <h2>No workspace open</h2>
          <p>Add a workspace to start Codex3D terminals, preview panels, and dev terminals.</p>
          <button type="button" onClick={() => void onAddWorkspace()}>Add workspace</button>
        </div>
      )}

      {pendingCloseWorkspace ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="close-workspace-title">
            <h2 id="close-workspace-title">Close workspace?</h2>
            <p>This closes {pendingCloseWorkspace.name} and its Codex3D terminals, dev terminals, and preview panel.</p>
            <span>{pendingCloseWorkspace.path}</span>
            <div className="confirm-modal-actions">
              <button type="button" onClick={() => setPendingCloseWorkspace(undefined)}>Cancel</button>
              <button type="button" className="danger-button" disabled={busy} onClick={() => void closePendingWorkspace()}>Close workspace</button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingCloseSession ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="close-terminal-title">
            <h2 id="close-terminal-title">Close terminal?</h2>
            <p>This will stop and remove {pendingCloseSession.name} from the layout.</p>
            <span>{pendingCloseSession.cwd}</span>
            <div className="confirm-modal-actions">
              <button type="button" onClick={() => setPendingCloseSession(undefined)}>Cancel</button>
              <button type="button" className="danger-button" onClick={() => void closePendingSession()}>Close terminal</button>
            </div>
          </div>
        </div>
      ) : null}

      {tabMenu ? (
        <div className="context-menu-layer" role="presentation" onMouseDown={() => setTabMenu(undefined)}>
          <div
            className="tab-context-menu"
            role="menu"
            style={{ left: tabMenu.x, top: tabMenu.y }}
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setPendingRenameSession(tabMenu.session)
                setRenameValue(tabMenu.session.name)
                setTabMenu(undefined)
              }}
            >
              Rename
            </button>
          </div>
        </div>
      ) : null}

      {pendingRenameSession ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="rename-terminal-title">
            <h2 id="rename-terminal-title">Rename terminal</h2>
            <p>Set a local display name for this terminal tab.</p>
            <input
              value={renameValue}
              onChange={event => setRenameValue(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') renamePendingSession()
                if (event.key === 'Escape') setPendingRenameSession(undefined)
              }}
              autoFocus
            />
            <div className="confirm-modal-actions">
              <button type="button" onClick={() => setPendingRenameSession(undefined)}>Cancel</button>
              <button type="button" className="danger-button" onClick={renamePendingSession}>Rename</button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingClosePaneId ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="close-pane-title">
            <h2 id="close-pane-title">Close split panel?</h2>
            <p>This closes the split panel. Terminal tabs inside it will move with the remaining layout only if already moved elsewhere.</p>
            <div className="confirm-modal-actions">
              <button type="button" onClick={() => setPendingClosePaneId(undefined)}>Cancel</button>
              <button type="button" className="danger-button" onClick={closePendingPane}>Close panel</button>
            </div>
          </div>
        </div>
      ) : null}

      {launchModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal provider-launch-modal" role="dialog" aria-modal="true" aria-labelledby="launch-terminal-title">
            <h2 id="launch-terminal-title">New terminal</h2>
            <p>Choose the provider for this agent terminal.</p>
            <div className="provider-option-list" role="radiogroup" aria-label="Terminal provider">
              {providerOptions.map(option => (
                <label key={option.provider} className={`provider-option ${launchProvider === option.provider ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="terminal-provider"
                    value={option.provider}
                    checked={launchProvider === option.provider}
                    onChange={() => setLaunchProvider(option.provider)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.found ? option.detail ?? 'Ready' : option.detail ?? 'Missing binary'}</small>
                  </span>
                  <b>{option.found ? 'Ready' : 'Missing'}</b>
                </label>
              ))}
            </div>
            <div className="confirm-modal-actions">
              <button type="button" onClick={() => setLaunchModalOpen(false)}>Cancel</button>
              <button type="button" className="danger-button" disabled={busy} onClick={() => void launchSession()}>Launch terminal</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatWorkspacePath(path: string | undefined): { parent: string; leaf: string } | undefined {
  if (!path) return undefined
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  const leaf = parts.at(-1) ?? normalized
  const parent = normalized.endsWith(leaf) ? normalized.slice(0, -leaf.length) : ''
  return { parent, leaf }
}

function startRightPanelResize(event: React.PointerEvent<HTMLDivElement>, onResize: (width: number) => void) {
  const layout = event.currentTarget.parentElement
  if (!layout) return
  event.preventDefault()
  const rect = layout.getBoundingClientRect()

  function move(pointerEvent: PointerEvent) {
    onResize(rect.right - pointerEvent.clientX)
  }

  function stop() {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
    document.body.classList.remove('terminal-resizing')
  }

  document.body.classList.add('terminal-resizing')
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop, { once: true })
}

type SplitResizeHandleProps = {
  orientation: TerminalSplitOrientation
  sizes: number[]
  index: number
  onResize: (sizes: number[]) => void
  onReset: () => void
}

function SplitResizeHandle({ orientation, sizes, index, onResize, onReset }: SplitResizeHandleProps) {
  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    const split = event.currentTarget.parentElement
    if (!split) return
    event.preventDefault()
    const rect = split.getBoundingClientRect()
    const startPosition = orientation === 'horizontal' ? event.clientX : event.clientY
    const totalPixels = orientation === 'horizontal' ? rect.width : rect.height
    const startSizes = [...sizes]
    const previousSize = startSizes[index]
    const nextSize = startSizes[index + 1]
    const pairTotal = previousSize + nextSize
    const minimum = Math.min(30, pairTotal / 2)

    function move(pointerEvent: PointerEvent) {
      const currentPosition = orientation === 'horizontal' ? pointerEvent.clientX : pointerEvent.clientY
      const deltaPercent = ((currentPosition - startPosition) / totalPixels) * 100
      const resizedPrevious = clamp(previousSize + deltaPercent, minimum, pairTotal - minimum)
      const nextSizes = [...startSizes]
      nextSizes[index] = resizedPrevious
      nextSizes[index + 1] = pairTotal - resizedPrevious
      onResize(nextSizes)
    }

    function stop() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      document.body.classList.remove('terminal-resizing')
    }

    document.body.classList.add('terminal-resizing')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }

  return (
    <div
      className={`terminal-resize-handle terminal-resize-handle-${orientation}`}
      role="separator"
      aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
      onPointerDown={startResize}
      onDoubleClick={onReset}
    />
  )
}

function normalizeSizes(sizes: number[] | undefined, childCount: number): number[] {
  if (!childCount) return []
  const fallback = 100 / childCount
  const next = Array.from({ length: childCount }, (_, index) => Math.max(1, sizes?.[index] ?? fallback))
  const total = next.reduce((sum, size) => sum + size, 0)
  return next.map(size => (size / total) * 100)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

type SplitNodeViewProps = {
  node: TerminalLayoutNode
  sessionsById: Map<string, AgentSession>
  outputBySession: Record<string, string>
  activePaneId: string
  onSelectPane: (paneId: string) => void
  onSelectSession: (sessionId: string) => void
  onSelectPaneSession: (paneId: string, sessionId: string) => void
  onSplitPane: (paneId: string, orientation: TerminalSplitOrientation) => void
  onResizeSplit: (splitId: string, sizes: number[]) => void
  onMoveSessionToPane: (sessionId: string, targetPaneId: string) => void
  onClosePane: (paneId: string) => void
  onRequestCloseSession: (session: AgentSession) => void
  onRequestTabMenu: (request: TabContextMenuRequest) => void
  onLaunchSession: () => void
  onRestartSession: (sessionId?: string) => Promise<void>
  onStopSession: (sessionId?: string) => Promise<void>
  onSendInput: (sessionId: string, input: string) => Promise<void>
  onResizeTerminal: (sessionId: string, cols: number, rows: number) => void
  providerOptions: ProviderOption[]
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function SplitNodeView(props: SplitNodeViewProps) {
  const { node } = props
  if (node.type === 'split') {
    const sizes = normalizeSizes(node.sizes, node.children.length)
    return (
      <div className={`terminal-split terminal-split-${node.orientation}`}>
        {node.children.map((child, index) => (
          <div
            key={child.id}
            className="terminal-split-child"
            style={{ flexBasis: `${sizes[index]}%` }}
          >
            <SplitNodeView {...props} node={child} />
          </div>
        )).flatMap((child, index) => index === node.children.length - 1 ? [child] : [
          child,
          <SplitResizeHandle
            key={`${node.id}-resize-${index}`}
            orientation={node.orientation}
            sizes={sizes}
            index={index}
            onResize={nextSizes => props.onResizeSplit(node.id, nextSizes)}
            onReset={() => props.onResizeSplit(node.id, Array.from({ length: node.children.length }, () => 100 / node.children.length))}
          />,
        ])}
      </div>
    )
  }

  const paneSessions = unique(node.sessionIds).map(id => props.sessionsById.get(id)).filter((session): session is AgentSession => Boolean(session))
  const selectedSession = paneSessions.find(session => session.id === node.activeSessionId) ?? paneSessions[0]
  const visibleOutput = selectedSession ? props.outputBySession[selectedSession.id] ?? '' : ''
  const selectVisibleSession = () => {
    props.onSelectPane(node.id)
    if (!selectedSession) return
    props.onSelectPaneSession(node.id, selectedSession.id)
    props.onSelectSession(selectedSession.id)
  }

  return (
    <section
      className={`terminal-pane-frame ${node.id === props.activePaneId ? 'active' : ''}`}
      onFocus={selectVisibleSession}
      onMouseDown={selectVisibleSession}
    >
      <TerminalTabBar
        paneId={node.id}
        sessions={paneSessions}
        selectedSessionId={selectedSession?.id}
        onSelectSession={sessionId => {
          props.onSelectPaneSession(node.id, sessionId)
          props.onSelectSession(sessionId)
        }}
        onNewTerminal={props.onLaunchSession}
        onRestartSelected={() => void props.onRestartSession(selectedSession?.id)}
        onStopSelected={() => void props.onStopSession(selectedSession?.id)}
        onSplitPane={orientation => props.onSplitPane(node.id, orientation)}
        onMoveSessionToPane={props.onMoveSessionToPane}
        onRequestCloseSession={props.onRequestCloseSession}
        onRequestTabMenu={props.onRequestTabMenu}
        onClosePane={() => props.onClosePane(node.id)}
      />
      <TerminalView
        session={selectedSession}
        output={visibleOutput}
        onInput={input => {
          if (selectedSession) void props.onSendInput(selectedSession.id, input)
        }}
        onResize={(cols, rows) => {
          if (selectedSession) props.onResizeTerminal(selectedSession.id, cols, rows)
        }}
        onNewTerminal={props.onLaunchSession}
        onRestart={() => void props.onRestartSession(selectedSession?.id)}
        onStop={() => void props.onStopSession(selectedSession?.id)}
      />
    </section>
  )
}
