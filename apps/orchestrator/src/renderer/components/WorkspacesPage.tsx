import type { Workspace, WorkspaceMode } from '../../shared/types'

type WorkspacesPageProps = {
  workspaces: Workspace[]
  activeWorkspaceId?: string
  sessionCounts: Record<string, number>
  onChooseFolder: () => Promise<void>
  onSelectWorkspace: (workspaceId: string) => void
  onUpdateWorkspace: (workspaceId: string, input: Partial<Pick<Workspace, 'name' | 'defaultWorkspaceMode'>>) => void
  onRemoveWorkspace: (workspaceId: string) => void
}

const workspaceModes: WorkspaceMode[] = ['same-folder', 'new-worktree', 'selected-folder']

export function WorkspacesPage({
  workspaces,
  activeWorkspaceId,
  sessionCounts,
  onChooseFolder,
  onSelectWorkspace,
  onUpdateWorkspace,
  onRemoveWorkspace,
}: WorkspacesPageProps) {
  return (
    <section className="workspaces-page">
      <div className="workspaces-header">
        <div>
          <h2>Project workspaces</h2>
          <p>Each workspace owns its terminal sessions and launches Codex3D in its folder.</p>
        </div>
        <button type="button" className="primary" onClick={() => void onChooseFolder()}>Add workspace folder</button>
      </div>

      {workspaces.length === 0 ? (
        <div className="card workspace-empty-state">
          <h2>No workspaces yet</h2>
          <p>Select a local project folder. New Codex3D terminals will open in that directory.</p>
          <button type="button" className="primary" onClick={() => void onChooseFolder()}>Select folder</button>
        </div>
      ) : (
        <div className="workspace-list-grid">
          {workspaces.map(workspace => (
            <article className={`workspace-card ${workspace.id === activeWorkspaceId ? 'active' : ''}`} key={workspace.id}>
              <div className="workspace-card-main">
                <label>
                  Name
                  <input
                    value={workspace.name}
                    onChange={event => onUpdateWorkspace(workspace.id, { name: event.target.value || workspace.name })}
                  />
                </label>
                <span>{workspace.path}</span>
              </div>
              <div className="workspace-card-meta">
                <span>{sessionCounts[workspace.id] ?? 0} terminals</span>
                <label>
                  Mode
                  <select
                    value={workspace.defaultWorkspaceMode}
                    onChange={event => onUpdateWorkspace(workspace.id, { defaultWorkspaceMode: event.target.value as WorkspaceMode })}
                  >
                    {workspaceModes.map(mode => <option value={mode} key={mode}>{mode}</option>)}
                  </select>
                </label>
              </div>
              <div className="workspace-card-actions">
                <button type="button" onClick={() => onSelectWorkspace(workspace.id)}>
                  {workspace.id === activeWorkspaceId ? 'Active' : 'Use workspace'}
                </button>
                <button type="button" onClick={() => onRemoveWorkspace(workspace.id)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
