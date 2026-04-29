import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { spawn } from 'child_process'
import { pathToFileURL } from 'url'
import { listAgentAdapters } from '../agents/registry'
import { listLocalClaudeAgents } from '../agents/localAgents'
import { listLocalClaudeSkills } from '../skills/localSkills'
import { sessionManager } from '../sessions/sessionManager'
import { devTerminalManager } from '../devTerminals/devTerminalManager'
import {
  createDevTerminalSchema,
  devTerminalIdSchema,
  devTerminalInputSchema,
  launchAgentSchema,
  openWorkspaceSchema,
  renameDevTerminalSchema,
  renameSessionSchema,
  resizeDevTerminalSchema,
  resizeSessionSchema,
  sendInputSchema,
  stopSessionSchema,
} from '../../shared/schemas'

export function registerIpc(mainWindow: BrowserWindow): void {
  sessionManager.setHandlers({
    onOutput: event => mainWindow.webContents.send('agent:output', event),
    onStatus: session => mainWindow.webContents.send('agent:status', session),
  })

  devTerminalManager.setHandlers({
    onOutput: event => mainWindow.webContents.send('devTerminal:output', event),
    onStatus: terminal => mainWindow.webContents.send('devTerminal:status', terminal),
  })

  ipcMain.handle('providers:list', () => {
    return listAgentAdapters().map(adapter => ({
      id: adapter.id,
      displayName: adapter.displayName,
      supports: adapter.supports,
    }))
  })

  ipcMain.handle('providers:detect', async () => {
    return Promise.all(listAgentAdapters().map(adapter => adapter.detect()))
  })

  ipcMain.handle('agents:listLocalClaude', () => listLocalClaudeAgents())

  ipcMain.handle('skills:listLocalClaude', () => listLocalClaudeSkills())

  ipcMain.handle('workspaces:chooseFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select workspace folder',
    })
    return result.canceled ? undefined : result.filePaths[0]
  })

  ipcMain.handle('workspaces:openInVSCode', async (_event, input: unknown) => {
    const parsed = openWorkspaceSchema.parse(input)
    try {
      await openVSCodeNewWindow(parsed.path)
    } catch {
      await shell.openExternal(`vscode://file${pathToFileURL(parsed.path).pathname}`)
    }
  })

  ipcMain.handle('devTerminals:list', () => devTerminalManager.list())

  ipcMain.handle('devTerminals:outputs', () => devTerminalManager.outputs())

  ipcMain.handle('devTerminals:create', (_event, input: unknown) => {
    return devTerminalManager.create(createDevTerminalSchema.parse(input))
  })

  ipcMain.handle('devTerminals:sendInput', (_event, input: unknown) => {
    const parsed = devTerminalInputSchema.parse(input)
    devTerminalManager.sendInput(parsed.terminalId, parsed.input)
  })

  ipcMain.handle('devTerminals:resize', (_event, input: unknown) => {
    const parsed = resizeDevTerminalSchema.parse(input)
    devTerminalManager.resize(parsed.terminalId, parsed.cols, parsed.rows)
  })

  ipcMain.handle('devTerminals:rename', (_event, input: unknown) => {
    const parsed = renameDevTerminalSchema.parse(input)
    return devTerminalManager.rename(parsed.terminalId, parsed.name)
  })

  ipcMain.handle('devTerminals:remove', (_event, input: unknown) => {
    const parsed = devTerminalIdSchema.parse(input)
    devTerminalManager.remove(parsed.terminalId)
  })

  ipcMain.handle('devTerminals:stop', (_event, input: unknown) => {
    const parsed = devTerminalIdSchema.parse(input)
    devTerminalManager.stop(parsed.terminalId)
  })

  ipcMain.handle('sessions:list', () => sessionManager.list())

  ipcMain.handle('sessions:outputs', () => sessionManager.outputs())

  ipcMain.handle('sessions:launch', (_event, input: unknown) => {
    return sessionManager.launch(launchAgentSchema.parse(input))
  })

  ipcMain.handle('sessions:sendInput', (_event, input: unknown) => {
    const parsed = sendInputSchema.parse(input)
    sessionManager.sendInput(parsed.sessionId, parsed.input)
  })

  ipcMain.handle('sessions:resize', (_event, input: unknown) => {
    const parsed = resizeSessionSchema.parse(input)
    sessionManager.resize(parsed.sessionId, parsed.cols, parsed.rows)
  })

  ipcMain.handle('sessions:restart', (_event, input: unknown) => {
    const parsed = stopSessionSchema.parse(input)
    return sessionManager.restart(parsed.sessionId)
  })

  ipcMain.handle('sessions:rename', (_event, input: unknown) => {
    const parsed = renameSessionSchema.parse(input)
    return sessionManager.rename(parsed.sessionId, parsed.name)
  })

  ipcMain.handle('sessions:remove', (_event, input: unknown) => {
    const parsed = stopSessionSchema.parse(input)
    sessionManager.remove(parsed.sessionId)
  })

  ipcMain.handle('sessions:stop', (_event, input: unknown) => {
    const parsed = stopSessionSchema.parse(input)
    sessionManager.stop(parsed.sessionId)
  })
}

function openVSCodeNewWindow(workspacePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('code', ['--new-window', workspacePath], {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}
