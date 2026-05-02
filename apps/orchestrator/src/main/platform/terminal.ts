import { accessSync, constants, statSync } from 'fs'
import { homedir } from 'os'
import { basename, delimiter, isAbsolute, join } from 'path'

type PtyLaunch = {
  command: string
  args: string[]
  input?: string
  display: string
}

const DEFAULT_UNIX_PATHS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/opt/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
]

export function getTerminalEnv(baseEnv: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(baseEnv).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )

  if (process.platform !== 'win32') {
    env.PATH = mergePaths(env.PATH, DEFAULT_UNIX_PATHS)
    env.SHELL = env.SHELL || getUserShell(baseEnv)
  }

  env.TERM = env.TERM || 'xterm-256color'
  return env
}

export function getTerminalPath(baseEnv: NodeJS.ProcessEnv = process.env): string {
  return getTerminalEnv(baseEnv).PATH || ''
}

export function getUserShell(baseEnv: NodeJS.ProcessEnv = process.env): string {
  if (process.platform === 'win32') return baseEnv.ComSpec || 'cmd.exe'

  const configuredShell = baseEnv.SHELL
  if (configuredShell && isExecutableFile(configuredShell)) return configuredShell
  if (process.platform === 'darwin' && isExecutableFile('/bin/zsh')) return '/bin/zsh'
  if (isExecutableFile('/bin/bash')) return '/bin/bash'
  return '/bin/sh'
}

export function resolveExecutable(command: string, searchPath = getTerminalPath()): string {
  if (process.platform === 'win32' || isAbsolute(command)) return command

  for (const pathPart of searchPath.split(delimiter).filter(Boolean)) {
    const candidate = join(pathPart, command)
    if (isExecutableFile(candidate)) return candidate
  }

  return command
}

export function getInteractiveShellArgs(shell = getUserShell()): string[] {
  if (process.platform === 'win32') return []

  const shellName = basename(shell)
  if (shellName === 'bash') return ['--login']
  if (shellName === 'zsh') return ['-l']
  if (shellName === 'fish') return ['--login']
  return []
}

export function buildPtyLaunch(command: string, args: string[]): PtyLaunch {
  if (process.platform === 'win32') {
    const commandLine = [command, ...args].map(quoteCmdArg).join(' ')
    return {
      command: getUserShell(),
      args: ['/d', '/k'],
      input: `${commandLine}\r`,
      display: commandLine,
    }
  }

  const shell = getUserShell()
  const resolvedCommand = resolveExecutable(command)
  const commandLine = `exec ${[resolvedCommand, ...args].map(quotePosixArg).join(' ')}`
  return {
    command: shell,
    args: getShellCommandArgs(shell, commandLine),
    display: commandLine,
  }
}

function getShellCommandArgs(shell: string, commandLine: string): string[] {
  const shellName = basename(shell)
  if (shellName === 'bash') return ['--login', '-i', '-c', commandLine]
  if (shellName === 'zsh') return ['-lic', commandLine]
  if (shellName === 'fish') return ['--login', '-i', '-c', commandLine]
  return ['-c', commandLine]
}

function mergePaths(currentPath: string | undefined, fallbackPaths: string[]): string {
  const parts = (currentPath ? currentPath.split(delimiter) : []).filter(Boolean)
  for (const fallbackPath of fallbackPaths) {
    if (!parts.includes(fallbackPath)) parts.push(fallbackPath)
  }
  return parts.join(delimiter)
}

export function getSafeCwd(cwd: string): string {
  if (isAccessibleDirectory(cwd)) return cwd
  return process.cwd() || homedir()
}

export function describeCwd(cwd: string): string {
  return isAccessibleDirectory(cwd) ? 'accessible' : 'missing or inaccessible'
}

function isAccessibleDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isExecutableFile(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function quotePosixArg(arg: string): string {
  if (arg.length === 0) return "''"
  if (/^[A-Za-z0-9_/:=.,+@%-]+$/.test(arg)) return arg
  return `'${arg.replace(/'/g, `'"'"'`)}'`
}

function quoteCmdArg(arg: string): string {
  if (arg.length === 0) return '""'
  if (!/[\s&()^<>|"%!]/.test(arg)) return arg
  return `"${arg.replace(/([&()^<>|"%!])/g, '^$1')}"`
}
