#!/usr/bin/env node
import {
  Config,
  getConfig,
  getImagesToUpload,
  getImagesToUploadFromCopyDirs,
  hasCache,
  hasConfig,
  setConfig,
  updateGDriveCache,
  uploadImages,
  UploadItem,
  validateTargets,
} from './index'

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
    rl.close()
    process.exit()
  }
}

const upload = async (
  getToUploadFunc: () => Promise<UploadItem[] | undefined>
) => {
  await validate()
  continueRunning = true
  const toUpload = await getToUploadFunc()
  if (!toUpload) return
  const response = await asyncQuestion(
    `Do you want to upload ${toUpload?.length} files? (y/N): `
  )
  if (response === 'y')
    await uploadImages(
      toUpload,
      (msg) => console.log(msg),
      () => continueRunning
    )
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

  while (true) {
    const question = `Select command:
(u) - Update Google Drive Cache
(c) - Configure settings
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
        await upload(getImagesToUpload)
        break
      case 'd':
        await upload(getImagesToUploadFromCopyDirs)
        break
      case 'a':
        const toUpload = await getImagesToUpload()
        const toCopy = await getImagesToUploadFromCopyDirs()
        if (!toCopy || !toUpload) break
        await upload(async () => toUpload.concat(toCopy))
        break
      case 'q':
        process.exit()
        break
      default:
        break
    }
  }
}
loop().then(() => rl.close())
