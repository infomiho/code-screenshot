import { loadConfig } from './config.js'
import { createHttpServer } from './server.js'
import { ScreenshotService } from './screenshot-service.js'

const config = loadConfig()
const screenshots = new ScreenshotService(config)
await screenshots.start()
const server = createHttpServer(config, screenshots)

await new Promise<void>((resolve, reject) => {
  server.once('error', reject)
  server.listen(config.port, '0.0.0.0', () => {
    server.off('error', reject)
    resolve()
  })
})
console.log(`Screenshot service listening on port ${config.port}.`)

let shuttingDown = false
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Received ${signal}; shutting down.`)
  let shutdownTimer: NodeJS.Timeout | undefined
  await Promise.race([
    new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeIdleConnections()
    }),
    new Promise<void>((resolve) => {
      shutdownTimer = setTimeout(() => {
        server.closeAllConnections()
        resolve()
      }, 30_000)
    }),
  ]).finally(() => clearTimeout(shutdownTimer))
  await screenshots.close()
  process.exitCode = 0
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
