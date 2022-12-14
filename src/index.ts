import { execCommand } from './exec'
import * as fs from 'fs'
import glob from 'glob'
import * as path from 'path'
import moment from 'moment'
import { getConfig } from './config'
import { getGDriveCache, setGDriveCache } from './cache'

export type UploadItem = { source: string; gDrive?: string; target?: string }

// Validation
export const validateTargets = () => {
  const errors: string[] = []
  const config = getConfig()
  if (!config) errors.push('No config found!')
  if (config) {
    const targetDir = path.resolve(config.target)
    if (!fs.existsSync(targetDir)) errors.push('Target dir not found')
  }
  return errors
}

export const asyncGlob = async (pattern: string): Promise<string[]> =>
  new Promise((resolve) => glob(pattern, (er, files) => resolve(files)))

// Get image candidates
export const getImagesToUpload = async () => {
  const config = getConfig()
  if (!config) return
  const gDriveFiles = getGDriveCache()
  if (!gDriveFiles) return
  const sourceFiles = (await asyncGlob(`${config.source}/**/*`)) as string[]
  const toUpload: UploadItem[] = []
  const fileTypes = config.fileTypes
    .split(',')
    .map((ft) => ft.trim().toLowerCase())
  for (const sourceFile of sourceFiles) {
    const stat = fs.statSync(sourceFile)
    const parsed = path.parse(sourceFile)
    if (fileTypes.includes(parsed.ext.toLowerCase())) {
      const date = moment(stat.birthtime)
      const dateFolder = date.format('YYYY-MM-DD')
      const gDrivePath = path.join(config.gDriveDir, dateFolder, parsed.base)
      const targetPath = path.join(config.target, dateFolder, parsed.base)
      const upload: UploadItem = { source: sourceFile }
      if (!gDriveFiles.some((d) => d.name === gDrivePath))
        upload.gDrive = gDrivePath
      if (!fs.existsSync(targetPath)) upload.target = targetPath
      if (upload.target || upload.gDrive) toUpload.push(upload)
    }
  }
  return toUpload
}
export const getImagesToUploadFromCopyDirs = async (): Promise<
  UploadItem[] | undefined
> => {
  const toUpload: UploadItem[] = []
  const config = getConfig()
  if (!config) return
  const dirs = config.copyDirs
  for (const dir of dirs || []) {
    const files = await asyncGlob(`${dir.source}/**/*`)
    for (const file of files) {
      const gDriveFiles = getGDriveCache()
      if (!gDriveFiles) return
      const relative = path.relative(dir.source, file)
      const gDrivePath = path.join(dir.gDriveDir, relative)
      const targetPath = path.join(dir.target, relative)
      const upload: UploadItem = { source: file }
      if (!gDriveFiles.some((d) => d.name === gDrivePath))
        upload.gDrive = gDrivePath
      if (!fs.existsSync(targetPath)) upload.target = targetPath
      if (upload.target || upload.gDrive) toUpload.push(upload)
    }
  }
  return toUpload
}

// Upload
export const uploadImages = async (
  toUpload: UploadItem[],
  log: (msg: string) => void,
  shouldContinue: () => boolean
) => {
  const pad = `${toUpload.length}`.length
  for (const item of toUpload) {
    if (!shouldContinue()) return
    log(
      `(${toUpload.indexOf(item).toString().padStart(pad, '0')}/${
        toUpload.length
      }) Processing: ${item.source}`
    )
    if (item.gDrive) {
      console.log(`Uploading to GDrive (${item.gDrive})`)
      const command = `rclone copyto "${item.source}" "gdrive:${item.gDrive}"`
      const result = await execCommand(command)
      if (result) console.error(result)
      const cache = getGDriveCache()?.concat({ name: item.gDrive, size: -1 })
      if (cache) setGDriveCache(cache)
    }
    if (item.target) {
      console.log(`Uploading to Target (${item.target})`)
      if (!fs.existsSync(path.dirname(item.target)))
        fs.mkdirSync(path.dirname(item.target), { recursive: true })
      fs.copyFileSync(item.source, item.target)
      const stat = fs.statSync(item.source)
      fs.utimesSync(item.target, stat.atime, stat.mtime)
    }
  }
}
