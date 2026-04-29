import { useEffect, useState } from 'react'
import type { AgentRole, AgentSession, DevTerminal, LocalAgent, LocalSkill } from '../shared/types'
import { SessionsPage } from './components/SessionsPage'
import { useAppStore } from './stores/appStore'

const navItems = [
  { label: 'Sessions', icon: '⌘' },
  { label: 'Skills & Agents', icon: '✦' },
  { label: 'Settings', icon: '⚙' },
] as const
type Page = typeof navItems[number]['label']

const roles: AgentRole[] = ['manual', 'planner', 'implementer', 'verifier', 'reviewer', 'tester', 'researcher']
const quickSkills = ['Codex3D Implementer', 'Codex3D Verifier', 'Codex3D Planner', '/buddy status', '/commit', '/simplify']

export function App() {
  const {
    workspaces,
    activeWorkspaceId,
    addWorkspace,
    setActiveWorkspace,
    sessions,
    activeSessionId,
    outputBySession,
    detections,
    setSessions,
    upsertSession,
    setActiveSessionId,
    setOutputBySession,
    appendOutput,
    setDetections,
    localAgents,
    setLocalAgents,
    localSkills,
    setLocalSkills,
    addSessionToActivePane,
    setActivePane,
    selectPaneSession,
    splitPane,
    resizeSplit,
    moveSessionToPane,
    removeSessionFromLayout,
    closePane,
    terminalLayout,
    activePaneId,
    previewUrlByWorkspaceId,
    previewPanelWidthByWorkspaceId,
    previewPanelHiddenByWorkspaceId,
    setWorkspacePreviewUrl,
    setWorkspacePreviewPanelWidth,
    setWorkspacePreviewPanelHidden,
  } = useAppStore()

  const [page, setPage] = useState<Page>('Sessions')
  const [role] = useState<AgentRole>('manual')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [devTerminals, setDevTerminals] = useState<DevTerminal[]>([])
  const [devOutputByTerminal, setDevOutputByTerminal] = useState<Record<string, string>>({})
  const [activeDevTerminalIdByWorkspaceId, setActiveDevTerminalIdByWorkspaceId] = useState<Record<string, string | undefined>>({})

  useEffect(() => {
    void Promise.all([
      window.orchestrator.sessions.list(),
      window.orchestrator.sessions.outputs(),
    ]).then(([sessions, outputBySession]) => {
      setSessions(sessions)
      setOutputBySession(outputBySession)
    })
    void window.orchestrator.providers.detect().then(setDetections)
    void window.orchestrator.agents.listLocalClaude().then(setLocalAgents)
    void window.orchestrator.skills.listLocalClaude().then(setLocalSkills)

    const offOutput = window.orchestrator.sessions.onOutput((event: { sessionId: string; chunk: string }) => {
      appendOutput(event.sessionId, event.chunk)
    })
    const offStatus = window.orchestrator.sessions.onStatus((session: AgentSession) => {
      upsertSession(session)
    })
    return () => {
      offOutput()
      offStatus()
    }
  }, [appendOutput, setDetections, setLocalAgents, setLocalSkills, setOutputBySession, setSessions, upsertSession])

  useEffect(() => {
    void Promise.all([
      window.orchestrator.devTerminals.list(),
      window.orchestrator.devTerminals.outputs(),
    ]).then(([terminals, outputs]) => {
      setDevTerminals(terminals)
      setDevOutputByTerminal(outputs)
    })

    const offOutput = window.orchestrator.devTerminals.onOutput((event: { terminalId: string; chunk: string }) => {
      setDevOutputByTerminal(current => ({
        ...current,
        [event.terminalId]: `${current[event.terminalId] ?? ''}${event.chunk}`,
      }))
    })
    const offStatus = window.orchestrator.devTerminals.onStatus((terminal: DevTerminal) => {
      setDevTerminals(current => current.some(item => item.id === terminal.id)
        ? current.map(item => item.id === terminal.id ? terminal : item)
        : [...current, terminal])
    })

    return () => {
      offOutput()
      offStatus()
    }
  }, [])


  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId)
  const workspaceSessions = sessions.filter(session => session.workspaceId === activeWorkspaceId)

  async function chooseWorkspaceFolder() {
    const path = await window.orchestrator.workspaces.chooseFolder()
    if (!path) return
    addWorkspace(path)
    setPage('Sessions')
  }

  async function launchCodex3D() {
    if (!activeWorkspace) {
      await chooseWorkspaceFolder()
      return
    }
    const terminalNumber = workspaceSessions.length + 1
    const session = await window.orchestrator.sessions.launch({
      provider: 'codex3d',
      role,
      cwd: activeWorkspace.path,
      workspaceId: activeWorkspace.id,
      workspaceMode: activeWorkspace.defaultWorkspaceMode,
      name: `Terminal ${terminalNumber}`,
    })
    upsertSession(session)
    addSessionToActivePane(session.id)
    setActiveSessionId(session.id)
    setPage('Sessions')
  }

  async function restartSession(sessionId: string) {
    const session = await window.orchestrator.sessions.restart(sessionId)
    upsertSession(session)
  }

  async function stopSession(sessionId: string) {
    await window.orchestrator.sessions.stop(sessionId)
  }

  async function sendSessionInput(sessionId: string, input: string) {
    await window.orchestrator.sessions.sendInput(sessionId, input)
  }

  async function closeSession(sessionId: string) {
    await window.orchestrator.sessions.remove(sessionId)
    removeSessionFromLayout(sessionId)
  }

  async function renamePersistedSession(sessionId: string, name: string) {
    const session = await window.orchestrator.sessions.rename(sessionId, name)
    upsertSession(session)
  }

  async function openWorkspaceInVSCode(path: string) {
    await window.orchestrator.workspaces.openInVSCode(path)
  }

  async function createDevTerminal() {
    if (!activeWorkspace) return
    const terminal = await window.orchestrator.devTerminals.create({
      workspaceId: activeWorkspace.id,
      cwd: activeWorkspace.path,
      name: `Dev ${devTerminals.filter(item => item.workspaceId === activeWorkspace.id).length + 1}`,
    })
    setDevTerminals(current => current.some(item => item.id === terminal.id) ? current : [...current, terminal])
    setActiveDevTerminalIdByWorkspaceId(current => ({ ...current, [activeWorkspace.id]: terminal.id }))
  }

  async function closeDevTerminal(terminalId: string) {
    await window.orchestrator.devTerminals.remove(terminalId)
    setDevTerminals(current => current.filter(terminal => terminal.id !== terminalId))
    setDevOutputByTerminal(current => {
      const { [terminalId]: _removed, ...next } = current
      return next
    })
  }

  function selectDevTerminal(terminalId: string) {
    if (!activeWorkspace) return
    setActiveDevTerminalIdByWorkspaceId(current => ({ ...current, [activeWorkspace.id]: terminalId }))
  }

  function sendDevTerminalInput(terminalId: string, input: string) {
    void window.orchestrator.devTerminals.sendInput(terminalId, input)
  }

  function resizeDevTerminal(terminalId: string, cols: number, rows: number) {
    void window.orchestrator.devTerminals.resize(terminalId, cols, rows)
  }

  function resizeTerminal(sessionId: string, cols: number, rows: number) {
    void window.orchestrator.sessions.resize(sessionId, cols, rows)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button
          type="button"
          className="sidebar-collapse-button"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setSidebarCollapsed(collapsed => !collapsed)}
        >
          <span className={`sidebar-collapse-icon ${sidebarCollapsed ? 'expand' : 'collapse'}`} aria-hidden="true" />
        </button>
        <div className="brand">
          <div className="brand-mark">C3D</div>
          <div className="brand-copy">
            <strong>Codex3D</strong>
            <span>Orchestrator</span>
          </div>
        </div>
        <nav>
          {navItems.map(item => (
            <button key={item.label} className={item.label === page ? 'active' : ''} aria-label={item.label} onClick={() => setPage(item.label)}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              <span className="nav-tooltip" role="tooltip">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        {page !== 'Sessions' ? (
          <header className="topbar">
            <div>
              <h1>{page}</h1>
              <p>{getPageDescription(page)}</p>
            </div>
          </header>
        ) : null}

        {page === 'Sessions' && (
          <SessionsPage
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={setActiveWorkspace}
            onAddWorkspace={chooseWorkspaceFolder}
            onOpenWorkspaceInVSCode={openWorkspaceInVSCode}
            sessions={workspaceSessions}
            selectedSessionId={activeSessionId}
            outputBySession={outputBySession}
            terminalLayout={terminalLayout}
            activePaneId={activePaneId}
            onSelectSession={setActiveSessionId}
            onSelectPane={setActivePane}
            onSelectPaneSession={selectPaneSession}
            onSplitPane={splitPane}
            onResizeSplit={resizeSplit}
            onMoveSessionToPane={moveSessionToPane}
            onClosePane={closePane}
            onLaunchSession={launchCodex3D}
            onRestartSession={restartSession}
            onStopSession={stopSession}
            onCloseSession={closeSession}
            onRenameSession={renamePersistedSession}
            onSendInput={sendSessionInput}
            onResizeTerminal={resizeTerminal}
            devTerminals={devTerminals.filter(terminal => terminal.workspaceId === activeWorkspaceId)}
            activeDevTerminalId={activeWorkspaceId ? activeDevTerminalIdByWorkspaceId[activeWorkspaceId] : undefined}
            devOutputByTerminal={devOutputByTerminal}
            previewUrl={activeWorkspaceId ? previewUrlByWorkspaceId[activeWorkspaceId] : undefined}
            previewPanelWidth={activeWorkspaceId ? previewPanelWidthByWorkspaceId[activeWorkspaceId] : undefined}
            previewPanelHidden={activeWorkspaceId ? Boolean(previewPanelHiddenByWorkspaceId[activeWorkspaceId]) : false}
            onSetPreviewUrl={setWorkspacePreviewUrl}
            onSetPreviewPanelWidth={(width: number) => {
              if (activeWorkspaceId) setWorkspacePreviewPanelWidth(activeWorkspaceId, width)
            }}
            onSetPreviewPanelHidden={(hidden: boolean) => {
              if (activeWorkspaceId) setWorkspacePreviewPanelHidden(activeWorkspaceId, hidden)
            }}
            onCreateDevTerminal={createDevTerminal}
            onSelectDevTerminal={selectDevTerminal}
            onCloseDevTerminal={closeDevTerminal}
            onSendDevInput={sendDevTerminalInput}
            onResizeDevTerminal={resizeDevTerminal}
          />
        )}
        {page === 'Skills & Agents' && renderSkillsAndAgents(localAgents, localSkills)}
        {page === 'Settings' && renderSettings(detections)}
      </main>
    </div>
  )
}

function getPageDescription(page: Page): string {
  switch (page) {
    case 'Sessions':
      return 'Interact with running Codex3D sessions for the active workspace.'
    case 'Skills & Agents':
      return 'Manage reusable agent presets and local Claude skills from ~/.claude/skills.'
    case 'Settings':
      return 'Configure providers, defaults, terminal behavior, and safety controls.'
  }
}

function renderSkillsAndAgents(localAgents: LocalAgent[], localSkills: LocalSkill[]) {
  const builtinSkills = ['/buddy status', '/buddy export', '/buddy import', '/help', '/fast', '/commit', '/simplify', '/loop']

  return (
    <section className="grid two">
      <div className="card">
        <h2>Local agents</h2>
        {localAgents.length === 0 ? (
          <p>No agents found in ~/.claude/agents.</p>
        ) : localAgents.map(agent => (
          <div className="row" key={agent.id} title={agent.path}>
            <div>
              <strong>{agent.name}</strong>
              <span>{agent.description}</span>
              <span>{agent.path}</span>
            </div>
            <span className="pill ok">Agent</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Local skills</h2>
        {localSkills.length === 0 ? (
          <p>No skills found in ~/.claude/skills.</p>
        ) : localSkills.map(skill => (
          <div className="row" key={skill.id} title={skill.path}>
            <div>
              <strong>{skill.name}</strong>
              <span>{skill.description}</span>
              <span>{skill.path}</span>
            </div>
            <span className={skill.hasReadme ? 'pill ok' : 'pill'}>{skill.hasReadme ? 'README' : 'Folder'}</span>
          </div>
        ))}
      </div>
      <div className="card wide-card">
        <h2>Codex3D presets</h2>
        <div className="skills-grid">
          {['Codex3D Manual', 'Codex3D Planner', 'Codex3D Implementer', 'Codex3D Verifier', 'Codex3D Reviewer'].map(preset => (
            <div className="skill-tile" key={preset}>{preset}</div>
          ))}
        </div>
      </div>
      <div className="card wide-card">
        <h2>Built-in quick commands</h2>
        <div className="skills-grid">
          {builtinSkills.map(skill => <div className="skill-tile" key={skill}>{skill}</div>)}
        </div>
      </div>
    </section>
  )
}

function renderSettings(detections: ReturnType<typeof useAppStore.getState>['detections']) {
  return (
    <section className="grid two">
      <div className="card">
        <h2>Providers</h2>
        {detections.map(detection => (
          <div className="row" key={detection.provider}>
            <div>
              <strong>{detection.provider}</strong>
              <span>{detection.binaryPath ?? detection.error ?? 'Not configured'}</span>
            </div>
            <span className={detection.found ? 'pill ok' : 'pill'}>{detection.found ? 'Ready' : 'Missing'}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Safety defaults</h2>
        <div className="setting-list">
          <label><input type="checkbox" defaultChecked /> Confirm before deleting worktrees</label>
          <label><input type="checkbox" defaultChecked /> Confirm before killing sessions</label>
          <label><input type="checkbox" defaultChecked /> Confirm before custom binaries</label>
          <label><input type="checkbox" defaultChecked /> Confirm before git push</label>
        </div>
      </div>
    </section>
  )
}
