import { useEffect, useState } from 'react'
import type { AgentRole, AgentSession, LocalAgent, LocalSkill, WorkspaceMode } from '../shared/types'
import { SessionsPage } from './components/SessionsPage'
import { useAppStore } from './stores/appStore'

const navItems = ['Dashboard', 'Workspaces', 'Sessions', 'Skills & Agents', 'Settings'] as const
type Page = typeof navItems[number]

const roles: AgentRole[] = ['manual', 'planner', 'implementer', 'verifier', 'reviewer', 'tester', 'researcher']
const workspaceModes: WorkspaceMode[] = ['same-folder', 'new-worktree', 'selected-folder']
const quickSkills = ['Codex3D Implementer', 'Codex3D Verifier', 'Codex3D Planner', '/buddy status', '/commit', '/simplify']

export function App() {
  const {
    sessions,
    activeSessionId,
    outputBySession,
    detections,
    setSessions,
    upsertSession,
    setActiveSessionId,
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
    moveSessionToPane,
    removeSessionFromLayout,
    terminalLayout,
    activePaneId,
  } = useAppStore()

  const [page, setPage] = useState<Page>('Dashboard')
  const [cwd, setCwd] = useState('C:/Users/Mestre/Desktop/myprojects/codex3d')
  const [role, setRole] = useState<AgentRole>('manual')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('same-folder')


  useEffect(() => {
    void window.orchestrator.sessions.list().then(setSessions)
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
  }, [appendOutput, setDetections, setLocalAgents, setLocalSkills, setSessions, upsertSession])

  async function launchCodex3D() {
    const terminalNumber = sessions.length + 1
    const session = await window.orchestrator.sessions.launch({
      provider: 'codex3d',
      role,
      cwd,
      workspaceMode,
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
    await window.orchestrator.sessions.stop(sessionId)
    removeSessionFromLayout(sessionId)
  }

  function resizeTerminal(sessionId: string, cols: number, rows: number) {
    void window.orchestrator.sessions.resize(sessionId, cols, rows)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C3D</div>
          <div>
            <strong>Codex3D</strong>
            <span>Orchestrator</span>
          </div>
        </div>
        <nav>
          {navItems.map(item => (
            <button key={item} className={item === page ? 'active' : ''} onClick={() => setPage(item)}>{item}</button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>{page}</h1>
            <p>{getPageDescription(page)}</p>
          </div>
          <button className="primary" onClick={launchCodex3D}>Launch Codex3D</button>
        </header>

        {page === 'Dashboard' && renderDashboard({ detections, cwd, setCwd, role, setRole, workspaceMode, setWorkspaceMode })}
        {page === 'Workspaces' && renderWorkspaces(cwd, setCwd, workspaceMode, setWorkspaceMode)}
        {page === 'Sessions' && (
          <SessionsPage
            sessions={sessions}
            selectedSessionId={activeSessionId}
            outputBySession={outputBySession}
            terminalLayout={terminalLayout}
            activePaneId={activePaneId}
            onSelectSession={setActiveSessionId}
            onSelectPane={setActivePane}
            onSelectPaneSession={selectPaneSession}
            onSplitPane={splitPane}
            onMoveSessionToPane={moveSessionToPane}
            onLaunchSession={launchCodex3D}
            onRestartSession={restartSession}
            onStopSession={stopSession}
            onCloseSession={closeSession}
            onSendInput={sendSessionInput}
            onResizeTerminal={resizeTerminal}
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
    case 'Dashboard':
      return 'Launch and coordinate multiple Codex3D sessions. Other agent CLIs fit through adapters later.'
    case 'Workspaces':
      return 'Manage project folders, workspace modes, and future isolated worktrees.'
    case 'Sessions':
      return 'Interact with running Codex3D sessions and send prompts or slash commands.'
    case 'Skills & Agents':
      return 'Manage reusable agent presets and local Claude skills from ~/.claude/skills.'
    case 'Settings':
      return 'Configure providers, defaults, terminal behavior, and safety controls.'
  }
}

function renderDashboard(props: {
  detections: ReturnType<typeof useAppStore.getState>['detections']
  cwd: string
  setCwd: (cwd: string) => void
  role: AgentRole
  setRole: (role: AgentRole) => void
  workspaceMode: WorkspaceMode
  setWorkspaceMode: (mode: WorkspaceMode) => void
}) {
  return (
    <>
      <section className="grid two">
        <div className="card">
          <h2>Provider health</h2>
          {props.detections.length === 0 ? <p>Detecting providers...</p> : props.detections.map(detection => (
            <div className="row" key={detection.provider}>
              <div>
                <strong>{detection.provider}</strong>
                <span>{detection.version ?? detection.error ?? 'Not configured'}</span>
              </div>
              <span className={detection.found ? 'pill ok' : 'pill'}>{detection.found ? 'Ready' : 'Missing'}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>New Codex3D agent</h2>
          <label>
            Workspace path
            <input value={props.cwd} onChange={event => props.setCwd(event.target.value)} />
          </label>
          <div className="form-row">
            <label>
              Role
              <select value={props.role} onChange={event => props.setRole(event.target.value as AgentRole)}>
                {roles.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Workspace mode
              <select value={props.workspaceMode} onChange={event => props.setWorkspaceMode(event.target.value as WorkspaceMode)}>
                {workspaceModes.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Skills & Agents preview</h2>
        <div className="skills-grid">
          {quickSkills.map(item => <div className="skill-tile" key={item}>{item}</div>)}
        </div>
      </section>
    </>
  )
}

function renderWorkspaces(cwd: string, setCwd: (cwd: string) => void, workspaceMode: WorkspaceMode, setWorkspaceMode: (mode: WorkspaceMode) => void) {
  return (
    <section className="grid two">
      <div className="card">
        <h2>Current workspace</h2>
        <label>
          Project path
          <input value={cwd} onChange={event => setCwd(event.target.value)} />
        </label>
        <div className="row workspace-row">
          <div>
            <strong>codex3d</strong>
            <span>{cwd}</span>
          </div>
          <span className="pill ok">Active</span>
        </div>
      </div>
      <div className="card">
        <h2>Workspace mode</h2>
        <label>
          Default launch mode
          <select value={workspaceMode} onChange={event => setWorkspaceMode(event.target.value as WorkspaceMode)}>
            {workspaceModes.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <p className="note">Worktree creation will use short paths later to avoid Windows path-length issues.</p>
      </div>
    </section>
  )
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
