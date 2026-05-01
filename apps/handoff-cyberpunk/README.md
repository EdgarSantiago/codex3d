# Codex3D Orchestrator — Variant A (Conservative polish)

Drop-in redesign for your terminal orchestrator. Same layout and features as your current UI, just polished: cleaner spacing, restrained red accent (active workspace + primary CTA + focused-panel border only), calmer empty states with keyboard-shortcut hints.

## What's in this folder

```
handoff/
├── index.html           # Standalone preview — open in browser to see it
├── Orchestrator.jsx     # Single-file React component
├── orchestrator.css     # All styles (uses CSS custom properties)
└── README.md
```

## Quick preview

Open `index.html` directly in a browser. It runs React via CDN + in-browser Babel — no build step needed.

## Integrating into your real project

### 1. Copy the files

```bash
cp handoff/Orchestrator.jsx     apps/orchestrator/src/components/
cp handoff/orchestrator.css     apps/orchestrator/src/styles/
```

Rename `Orchestrator.jsx` to `.tsx` if you're on TypeScript — the code is plain enough that types will infer cleanly, or you can add prop types as you go.

### 2. Remove the demo-only bits

At the bottom of `Orchestrator.jsx`, delete the `window.X = X` block. Replace with:

```jsx
export { Orchestrator, TerminalPanel, PreviewCard, DevTerminalsCard, TopBar, LeftRail };
export default Orchestrator;
```

Remove the `MockTerminal` component and the demo `Orchestrator` function — they exist only to show the layout. Wire `<TerminalPanel>`, `<PreviewCard>`, and `<DevTerminalsCard>` to your real state.

### 3. Import the CSS once

In your app entry (e.g. `main.tsx`):

```js
import './styles/orchestrator.css';
```

### 4. Compose with your real components

```jsx
import { TopBar, LeftRail, TerminalPanel, PreviewCard, DevTerminalsCard } from './components/Orchestrator';
import YourTerminal from './YourTerminal';

function App() {
  const [terminals, setTerminals] = useTerminals();   // your hook
  const [focusedId, setFocusedId] = useState(null);

  return (
    <div className="orch-root">
      <LeftRail />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          workspaces={workspaces}
          active={activeWorkspace}
          path={cwd}
          onSelect={selectWorkspace}
          onAdd={addWorkspace}
          onOpenInVSCode={openInVSCode}
        />
        <div className="orch-main">
          <div className="orch-grid">
            {terminals.map(t => (
              <TerminalPanel
                key={t.id}
                title={t.title}
                badge={t.kind}
                focused={focusedId === t.id}
                empty={!t.running}
                onCreate={() => spawn(t.id)}
                onSplitRight={() => split(t.id, 'right')}
                onSplitDown={() => split(t.id, 'down')}
                onRestart={() => restart(t.id)}
                onStop={() => stop(t.id)}
                onClose={() => close(t.id)}
              >
                <YourTerminal id={t.id} />
              </TerminalPanel>
            ))}
          </div>
          <aside className="orch-side">
            <PreviewCard url={previewUrl} onLoad={setPreviewUrl} onReload={reload} />
            <DevTerminalsCard onNew={createDevTerminal} />
          </aside>
        </div>
      </main>
    </div>
  );
}
```

## Theming

All colors live as CSS custom properties on `:root` in `orchestrator.css`. To shift the accent or background, override them on a parent element — for example, in your global stylesheet:

```css
:root {
  --orch-red: #c92a36;          /* darker red */
  --orch-bg:  #08080a;          /* deeper black */
}
```

The full set:

| Variable             | Default         | Usage |
|----------------------|-----------------|-------|
| `--orch-bg`          | `#0b0b0c`       | App background |
| `--orch-surface`     | `#141416`       | Panel surfaces |
| `--orch-surface-2`   | `#1a1a1d`       | Raised / focused header |
| `--orch-surface-3`   | `#202024`       | Hover state |
| `--orch-border`      | `#26262a`       | Default borders |
| `--orch-border-hi`   | `#34343a`       | Stronger borders, hover |
| `--orch-text`        | `#e6e6e8`       | Primary text |
| `--orch-text-dim`    | `#9a9aa3`       | Secondary text |
| `--orch-text-mute`   | `#5f5f68`       | Hints / placeholders |
| `--orch-red`         | `#e63946`       | Primary accent |
| `--orch-red-hover`   | `#f04654`       | CTA hover |
| `--orch-red-soft`    | `rgba(...0.12)` | Soft tint backgrounds |
| `--orch-green`       | `#22c55e`       | Live / online status |
| `--orch-mono`        | JetBrains Mono  | Terminal font |
| `--orch-sans`        | Inter           | UI font |

## Component API

### `<TopBar>`
Workspace tabs + path breadcrumb + "Open in VS Code".

| Prop            | Type                   | Notes |
|-----------------|------------------------|-------|
| `workspaces`    | `string[]`             | Tab labels |
| `active`        | `string`               | Currently selected workspace |
| `path`          | `string`               | Path to display (last segment is highlighted) |
| `onSelect`      | `(name) => void`       | Tab click |
| `onAdd`         | `() => void`           | "+ Add" click |
| `onOpenInVSCode`| `() => void`           | CTA click |

### `<TerminalPanel>`
A single grid cell that hosts **multiple terminal tabs**. Pass an array of tabs and the active id; render your terminal body as `children` (typically keyed off `activeId`).

| Prop           | Type                              | Notes |
|----------------|-----------------------------------|-------|
| `tabs`         | `{id, title, badge?}[]`           | Tab list; empty array → empty state |
| `activeId`     | `string`                          | Currently selected tab |
| `focused`      | `boolean`                         | Adds red border + brighter header |
| `onSelect`     | `(id) => void`                    | Tab click |
| `onAddTab`     | `() => void`                      | "+" button in tab strip |
| `onCloseTab`   | `(id) => void`                    | Per-tab × button |
| `onCreate`     | `() => void`                      | Empty-state CTA |
| `onSplitRight` | `() => void`                      | |
| `onSplitDown`  | `() => void`                      | |
| `onRestart`    | `() => void`                      | |
| `onStop`       | `() => void`                      | |
| `onClosePanel` | `() => void`                      | Closes the whole panel |

Example:

```jsx
<TerminalPanel
  tabs={[{id:'1', title:'Terminal 1', badge:'codexy'}, {id:'2', title:'tail logs'}]}
  activeId={activeId}
  focused
  onSelect={setActiveId}
  onAddTab={addTab}
  onCloseTab={closeTab}
>
  <YourTerminal id={activeId} />
</TerminalPanel>
```

### `<PreviewCard>`
URL input + iframe stage. Wire `onLoad(url)` to mount your own iframe in place of the dashed placeholder.

### `<DevTerminalsCard>`
Header + body. Replace the placeholder body with your real dev-terminal list.

## Fonts

The preview HTML loads **Inter** and **JetBrains Mono** from Google Fonts. In your real app, either:

- Keep the `<link>` tags from `index.html`, or
- Self-host them, or
- Override `--orch-mono` / `--orch-sans` to fonts you already ship.

## Notes & assumptions

- The icon set in `Orchestrator.jsx` is intentionally minimal (inline SVG, no dependency). Swap to `lucide-react` or your own icon library if you prefer — the names map 1:1 in most cases (`Plus`, `X`, `Terminal`, `RefreshCw`, etc.).
- The grid is fixed at 2×2 in this variant. Making it dynamic (1×1 / 2×1 / 2×2) is straightforward — change `.orch-grid` to compute `grid-template-*` from a layout prop.
- Keyboard shortcuts in the empty state (`⌘N`) are display-only. Wire your real shortcut handler to call `onCreate`.
- The "active" badge color (`codexy` chip) uses solid red; switch to `var(--orch-red-soft)` + red text if you want it quieter.
