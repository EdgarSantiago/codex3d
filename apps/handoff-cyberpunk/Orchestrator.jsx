/**
 * Codex3D Orchestrator — Variant A (Conservative polish)
 *
 * Each panel can host MULTIPLE terminal tabs (matching your real product).
 *
 * Usage in your app:
 *   <TerminalPanel
 *     focused
 *     tabs={[{id:'1', title:'Terminal 1', badge:'codexy'}, {id:'2', title:'tail logs'}]}
 *     activeId="1"
 *     onSelect={setActive}
 *     onAddTab={addTab}
 *     onCloseTab={closeTab}
 *     onSplitRight={...} onSplitDown={...} onRestart={...} onStop={...} onClosePanel={...}
 *   >
 *     <YourTerminal id={activeId} />
 *   </TerminalPanel>
 */

const { useState } = React;

function Icon({ name, size = 14 }) {
  const p = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'plus':    return <svg {...p}><path d="M8 3v10M3 8h10"/></svg>;
    case 'close':   return <svg {...p}><path d="M4 4l8 8M12 4l-8 8"/></svg>;
    case 'splitH':  return <svg {...p}><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M8 3v10"/></svg>;
    case 'splitV':  return <svg {...p}><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 8h12"/></svg>;
    case 'restart': return <svg {...p}><path d="M3 8a5 5 0 1 0 1.5-3.5L3 6"/><path d="M3 3v3h3"/></svg>;
    case 'stop':    return <svg {...p}><rect x="4" y="4" width="8" height="8" rx="1"/></svg>;
    case 'terminal':return <svg {...p}><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 7l2 1.5L5 10M8.5 10.5h3"/></svg>;
    case 'folder':  return <svg {...p}><path d="M2 5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/></svg>;
    case 'eye':     return <svg {...p}><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>;
    case 'settings':return <svg {...p}><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M1 8h2M13 8h2M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/></svg>;
    case 'reload':  return <svg {...p}><path d="M13 8a5 5 0 1 1-1.5-3.5L13 6"/><path d="M13 3v3h-3"/></svg>;
    case 'chevD':   return <svg {...p}><path d="M4 6l4 4 4-4"/></svg>;
    case 'cmd':     return <svg {...p}><path d="M5 3a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4 2 2 0 0 0-2 2v6a2 2 0 1 0 2-2H5a2 2 0 1 0-2 2 2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>;
    default: return null;
  }
}

function LeftRail() {
  return (
    <aside className="orch-rail">
      <div className="orch-rail-logo">C3D</div>
      <button className="orch-btn orch-iconbtn" style={{ width: 32, height: 32 }} title="Command palette"><Icon name="cmd" size={16} /></button>
      <button className="orch-btn orch-iconbtn" style={{ width: 32, height: 32 }} title="New workspace"><Icon name="plus" size={16} /></button>
      <button className="orch-btn orch-iconbtn" style={{ width: 32, height: 32 }} title="Settings"><Icon name="settings" size={16} /></button>
    </aside>
  );
}

function TopBar({ workspaces = ['codex3d', 'orchestrator'], active = 'orchestrator', path = '~/Desktop/myprojects/codex3d/apps/orchestrator', onSelect, onAdd, onOpenInVSCode }) {
  return (
    <header className="orch-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {workspaces.map(w => (
          <button key={w} className={`orch-btn orch-chip${w === active ? ' active' : ''}`} onClick={() => onSelect && onSelect(w)}>{w}</button>
        ))}
        <button className="orch-btn orch-chip" onClick={onAdd}><Icon name="plus" size={11}/> Add</button>
      </div>
      <div className="orch-vdivider" style={{ margin: '0 4px', height: 22 }} />
      <div className="orch-topbar-path">
        <Icon name="folder" size={13} />
        {(() => { const parts = path.split('/'); return <span>{parts.slice(0, -1).join('/')}/<b>{parts.at(-1)}</b></span>; })()}
      </div>
      <button className="orch-btn orch-cta subtle" onClick={onOpenInVSCode} style={{ height: 28, fontSize: 12 }}>Open in VS Code</button>
    </header>
  );
}

// ── Panel header with TAB STRIP ──────────────────────────────
function PanelHeader({ tabs, activeId, focused, onSelect, onAddTab, onCloseTab, onSplitRight, onSplitDown, onRestart, onStop, onClosePanel }) {
  return (
    <div className="orch-panel-head">
      <div className="orch-tabs">
        {tabs.map(t => {
          const isActive = t.id === activeId;
          return (
            <button key={t.id} className={`orch-tab${isActive ? ' is-active' : ''}`} onClick={() => onSelect && onSelect(t.id)} title={t.title}>
              <Icon name="terminal" size={11} />
              <span className="orch-tab-title">{t.title}</span>
              {t.badge && <span className="orch-badge">{t.badge}</span>}
              <span className="orch-tab-close" onClick={e => { e.stopPropagation(); onCloseTab && onCloseTab(t.id); }} title="Close tab">
                <Icon name="close" size={9} />
              </span>
            </button>
          );
        })}
        <button className="orch-btn orch-iconbtn orch-tab-add" title="New tab" onClick={onAddTab}><Icon name="plus" size={12} /></button>
      </div>
      <div className="orch-panel-actions">
        <button className="orch-btn orch-iconbtn" title="Split right" onClick={onSplitRight}><Icon name="splitH" size={12} /></button>
        <button className="orch-btn orch-iconbtn" title="Split down"  onClick={onSplitDown}><Icon name="splitV" size={12} /></button>
        <button className="orch-btn orch-iconbtn" title="Restart"     onClick={onRestart}><Icon name="restart" size={12} /></button>
        <button className="orch-btn orch-iconbtn danger" title="Stop"  onClick={onStop}><Icon name="stop" size={12} /></button>
        <div className="sep" />
        <button className="orch-btn orch-iconbtn" title="Close panel"  onClick={onClosePanel}><Icon name="close" size={12} /></button>
      </div>
    </div>
  );
}

function EmptyPanel({ onCreate }) {
  return (
    <div className="orch-empty">
      <div className="orch-empty-icon"><Icon name="terminal" size={16} /></div>
      <div className="orch-empty-title">No terminals</div>
      <div className="orch-empty-sub">Start an independent Codex3D session in this slot.</div>
      <button className="orch-btn orch-cta" onClick={onCreate}><Icon name="plus" size={11} /> New Terminal</button>
      <div className="orch-empty-hint">or press <span className="orch-kbd">⌘</span> <span className="orch-kbd">N</span></div>
    </div>
  );
}

function TerminalPanel({ tabs = [], activeId, focused, onSelect, onAddTab, onCloseTab, onCreate, onSplitRight, onSplitDown, onRestart, onStop, onClosePanel, children }) {
  const empty = tabs.length === 0;
  return (
    <section className={`orch-panel${focused ? ' is-focused' : ''}`}>
      {empty ? null : (
        <PanelHeader tabs={tabs} activeId={activeId} focused={focused}
          onSelect={onSelect} onAddTab={onAddTab} onCloseTab={onCloseTab}
          onSplitRight={onSplitRight} onSplitDown={onSplitDown}
          onRestart={onRestart} onStop={onStop} onClosePanel={onClosePanel} />
      )}
      {empty ? <EmptyPanel onCreate={onCreate} /> : children}
    </section>
  );
}

function MockTerminal({ tab }) {
  return (
    <div className="orch-term orch-scroll">
      <div className="orch-term-banner">{tab?.title || 'terminal'}</div>
      <div><span className="orch-term-prompt">●</span> Hi. What would you like to work on?</div>
      <div style={{ height: 14 }} />
      <div><span className="orch-term-prompt">{'>'}</span> <span className="orch-caret" /></div>
      <div style={{ height: 18 }} />
      <div className="orch-term-dim">Buddy  L22 ▓▓▓░░░ 210/236 XP · x3 · 3d  ·  ? for shortcuts</div>
    </div>
  );
}

function PreviewCard({ url = 'http://localhost:5173', onLoad, onReload }) {
  const [value, setValue] = useState(url);
  return (
    <div className="orch-card preview">
      <div className="orch-card-head">
        <Icon name="eye" size={13} /><span className="orch-card-title">Preview</span>
        <span className="orch-card-sub">orchestrator</span>
        <div style={{ flex: 1 }} />
        <button className="orch-btn orch-iconbtn"><Icon name="chevD" size={12} /></button>
      </div>
      <div className="orch-preview-bar">
        <input className="orch-input" value={value} onChange={e => setValue(e.target.value)} style={{ flex: 1 }} />
        <button className="orch-btn orch-cta" style={{ height: 28, padding: '0 10px' }} onClick={() => onLoad && onLoad(value)}>Load</button>
        <button className="orch-btn orch-cta subtle" style={{ height: 28, padding: '0 10px' }} onClick={onReload}><Icon name="reload" size={12} /></button>
      </div>
      <div className="orch-preview-stage">Set a preview URL for this workspace.</div>
    </div>
  );
}

function DevTerminalsCard({ onNew }) {
  return (
    <div className="orch-card dev">
      <div className="orch-dev-head">
        <div style={{ flex: 1 }}>
          <div className="orch-card-title">Dev terminals</div>
          <div className="orch-card-sub" style={{ marginTop: 2 }}>Run commands in <span className="orch-mono" style={{ color: 'var(--orch-text-dim)' }}>orchestrator</span></div>
        </div>
        <button className="orch-btn orch-cta" style={{ height: 26, padding: '0 10px', fontSize: 11.5 }} onClick={onNew}><Icon name="plus" size={11} /> Terminal</button>
      </div>
      <div className="orch-dev-body">Create a dev terminal to run workspace commands.<div style={{ marginTop: 4 }}><span className="orch-caret" /></div></div>
    </div>
  );
}

// ── Demo: each panel manages its own tab list ───────────────
function PanelWithTabs({ initialTabs, focused, onFocus }) {
  const [tabs, setTabs] = useState(initialTabs || []);
  const [activeId, setActiveId] = useState(initialTabs?.[0]?.id || null);
  const addTab = () => {
    const id = 'T' + Date.now();
    const next = [...tabs, { id, title: `Terminal ${tabs.length + 1}` }];
    setTabs(next); setActiveId(id);
  };
  const closeTab = (id) => {
    const next = tabs.filter(t => t.id !== id);
    setTabs(next);
    if (id === activeId) setActiveId(next[0]?.id || null);
  };
  const activeTab = tabs.find(t => t.id === activeId);
  return (
    <div onMouseDown={onFocus} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      <TerminalPanel
        tabs={tabs} activeId={activeId} focused={focused}
        onSelect={setActiveId} onAddTab={addTab} onCloseTab={closeTab}
        onCreate={addTab}
      >
        <MockTerminal tab={activeTab} />
      </TerminalPanel>
    </div>
  );
}

function Orchestrator() {
  const [focused, setFocused] = useState(0);
  return (
    <div className="orch-root">
      <LeftRail />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar />
        <div className="orch-main">
          <div className="orch-grid">
            <PanelWithTabs focused={focused === 0} onFocus={() => setFocused(0)}
              initialTabs={[{ id: 't1', title: 'Terminal 1', badge: 'codexy' }, { id: 't2', title: 'tail logs' }]} />
            <PanelWithTabs focused={focused === 1} onFocus={() => setFocused(1)} initialTabs={[]} />
            <PanelWithTabs focused={focused === 2} onFocus={() => setFocused(2)} initialTabs={[]} />
            <PanelWithTabs focused={focused === 3} onFocus={() => setFocused(3)} initialTabs={[]} />
          </div>
          <aside className="orch-side">
            <PreviewCard />
            <DevTerminalsCard />
          </aside>
        </div>
      </main>
    </div>
  );
}

window.Orchestrator = Orchestrator;
window.TerminalPanel = TerminalPanel;
window.PreviewCard = PreviewCard;
window.DevTerminalsCard = DevTerminalsCard;
window.TopBar = TopBar;
window.LeftRail = LeftRail;
