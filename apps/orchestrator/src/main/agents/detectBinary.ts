import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function detectBinary(binaryPath: string): Promise<{ version?: string; error?: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, ['--version'], {
      shell: process.platform === 'win32',
      timeout: 5000,
      windowsHide: true,
    })
    return { version: (stdout || stderr).trim() || undefined }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown detection error' }
  }
}
