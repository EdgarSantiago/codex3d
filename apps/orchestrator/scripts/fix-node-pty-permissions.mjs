import { chmodSync, existsSync } from 'fs'
import { join } from 'path'

const helpers = [
  join('node_modules', 'node-pty', 'prebuilds', 'darwin-arm64', 'spawn-helper'),
  join('node_modules', 'node-pty', 'prebuilds', 'darwin-x64', 'spawn-helper'),
]

for (const helper of helpers) {
  if (existsSync(helper)) chmodSync(helper, 0o755)
}
