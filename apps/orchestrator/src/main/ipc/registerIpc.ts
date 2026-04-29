import { ipcMain, BrowserWindow, dialog } from 'electron'
import { listAgentAdapters } from '../agents/registry'
import { listLocalClaudeAgents } from '../agents/localAgents'
import { listLocalClaudeSkills } from '../skills/localSkills'
import { sessionManager } from '../sessions/sessionManager'
import {
  launchAgentSchema,
  resizeSessionSchema,
  sendInputSchema,
  stopSessionSchema,
} from '../../shared/schemas'

export function registerIpc(mainWindow: BrowserWindow): void {
  sessionManager.setHandlers({
    onOutput: event => mainWindow.webContents.send('agent:output', event),
    onStatus: session => mainWindow.webContents.send('agent:status', session),
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

  ipcMain.handle('sessions:list', () => sessionManager.list())

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

  ipcMain.handle('sessions:stop', (_event, input: unknown) => {
    const parsed = stopSessionSchema.parse(input)
    sessionManager.stop(parsed.sessionId)
  })
}
