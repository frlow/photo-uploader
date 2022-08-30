import fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const configFile = path.join(os.homedir(), '.photo-uploader', 'config.json')

export type Config = {
  source: string
  target: string
  gDriveDir: string
  fileTypes: string
  copyDirs?: {
    source: string
    target: string
    gDriveDir: string
  }[]
}

export const hasConfig = () => fs.existsSync(configFile)
export const getConfig = () =>
  fs.existsSync(configFile)
    ? (JSON.parse(fs.readFileSync(configFile, 'utf8')) as Config)
    : undefined
export const setConfig = (config: Partial<Config>) => {
  const oldConfig = getConfig()
  const configDir = path.parse(configFile).dir
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(
    configFile,
    JSON.stringify({ ...oldConfig, ...config }, null, 2),
    'utf8'
  )
}
