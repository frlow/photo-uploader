#!/usr/bin/env node
import {
  getImagesToUpload,
  getImagesToUploadFromCopyDirs,
  uploadImages,
  UploadItem,
  validateTargets,
} from './index'
import { Config, getConfig, hasConfig, setConfig } from './config'
import { hasCache, updateGDriveCache } from './cache'

const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const asyncQuestion = (question: string) =>
  new Promise((resolve: (val: string) => void) => {
    rl.question(question, function (input: string) {
      resolve(input)
    })
  })

const questionWithFallback = async (
  question: string,
  defaultValue: string | undefined
) => {
  while (true) {
    const value =
      (await asyncQuestion(
        `${question}${defaultValue ? ` (${defaultValue})` : ''}`
      )) || defaultValue
    if (value) return value
  }
}

const configureSettings = async () => {
  const config = getConfig() || ({} as Config)
  const source = await questionWithFallback('Source dir:', config.source)
  const target = await questionWithFallback('Target dir:', config.target)
  const gDriveDir = await questionWithFallback(
    'Google Drive dir:',
    config.gDriveDir
  )
  const fileTypes = await questionWithFallback('File types', config.fileTypes)
  return { source, target, gDriveDir, fileTypes }
}

const validate = async () => {
  const errors = await validateTargets()
  if (errors.length > 0) {
    errors.forEach((er) => console.error(`Error: ${er}`))
    return false
  }
  return true
}

const upload = async (
  getToUploadFunc: () => Promise<UploadItem[] | undefined>
) => {
  if (!(await validate())) return false
  continueRunning = true
  const toUpload = await getToUploadFunc()
  if (!toUpload) return
  if (toUpload.length === 0) {
    console.log('All files have been uploaded!')
    return true
  }
  const response = await asyncQuestion(
    `Do you want to upload ${toUpload?.length} files? (y/N): `
  )
  if (response === 'y')
    await uploadImages(
      toUpload,
      (msg) => console.log(msg),
      () => continueRunning
    )
  return true
}
let continueRunning = true
const loop = async () => {
  if (!hasCache()) {
    console.log('Loading Google Drive files...')
    await updateGDriveCache()
    console.log('Done!')
  }
  if (!hasConfig()) setConfig(await configureSettings())
  process.stdin.on('keypress', (chunk, key) => {
    if (key && key.name == 'q') continueRunning = false
  })

  main: while (true) {
    const question = `Select command:
(u) - Update Google Drive Cache
(c) - Configure settings
(m) - Manage additional copy dirs
(s) - Sync files
(d) - Copy dirs
(a) - Copy all, both sync and dirs
(q) - Quit
`
    const result = await asyncQuestion(question)
    switch (result) {
      case 'u':
        await updateGDriveCache()
        break
      case 'c':
        setConfig(await configureSettings())
        break
      case 's':
        if (!(await upload(getImagesToUpload))) break main
        break
      case 'd':
        if (!(await upload(getImagesToUploadFromCopyDirs))) break main
        break
      case 'a':
        const toUpload = await getImagesToUpload()
        const toCopy = await getImagesToUploadFromCopyDirs()
        if (!toCopy || !toUpload) break
        if (!(await upload(async () => toUpload.concat(toCopy)))) break main
        break
      case 'm':
        manage: while (true) {
          const config = getConfig()
          if (!config) break
          const mRes = await asyncQuestion(`Select command:
(l)  - List copy dirs
(a)  - Add copy dir
(d x) - Delete copy dir number x
(q)  - Done
`)
          switch (mRes.split(' ')[0]) {
            case 'q':
              break manage
            case 'l':
              ;(config.copyDirs || []).forEach((cd, i) => {
                console.log(`[${i}]
  Source: ${cd.source}
  Target: ${cd.target}
  GDrive: ${cd.gDriveDir}`)
              })
              break
            case 'd':
              try {
                const number = parseInt(mRes.split(' ')[1])
                config.copyDirs?.splice(number, 1)
                setConfig(config)
              } catch {}
              break
            case 'a':
              const source = await asyncQuestion('Source: ')
              const target = await asyncQuestion('Target: ')
              const gDrive = await asyncQuestion('GDrive: ')
              if (!source || !target || !gDrive) break
              config.copyDirs?.push({ source, target, gDriveDir: gDrive })
              setConfig(config)
              break
          }
        }
        break
      case 'q':
        break main
      default:
        break
    }
  }
}
loop().then(() => rl.close())
