import fs from 'fs'
import { execCommand } from './exec'
import path from 'path'
import os from 'os'

const gDriveCacheFile = path.join(os.homedir(), '.photo-uploader', 'cache.json')

export type GDriveCacheItem = { name: string; size: number }

export const hasCache = () => fs.existsSync(gDriveCacheFile)
export const loadGDriveFiles = async (): Promise<GDriveCacheItem[]> => {
  const files = await execCommand('rclone ls gdrive:')
  return files
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.split(' '))
    .map((line) => ({ name: line[1], size: parseInt(line[0]) }))
}
export const updateGDriveCache = async () =>
  setGDriveCache(await loadGDriveFiles())
export const setGDriveCache = (files: GDriveCacheItem[]) => {
  fs.writeFileSync(gDriveCacheFile, JSON.stringify(files, null, 2), 'utf8')
}
export const getGDriveCache = () => {
  return fs.existsSync(gDriveCacheFile)
    ? (JSON.parse(
        fs.readFileSync(gDriveCacheFile, 'utf8')
      ) as GDriveCacheItem[])
    : undefined
}
