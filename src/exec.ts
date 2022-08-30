import { spawn } from 'child_process'

export const execCommand = async (
  command: string,
  log: (msg: string) => void = () => {}
): Promise<string> =>
  await new Promise((resolve) => {
    let totalLog = ''
    const writeLog = (str: string) => {
      log(str)
      totalLog += str
    }
    const child = spawn(command, [], { shell: true })
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', function (data) {
      writeLog(data.toString())
    })

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', function (data) {
      writeLog(data.toString())
    })

    child.on('close', function (code) {
      resolve(totalLog)
    })
  })
