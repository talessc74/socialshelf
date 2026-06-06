import { buildApp } from './app.js'

const port = Number(process.env['GENERATOR_PORT'] ?? 3003)
const host = '0.0.0.0'

const app = await buildApp()

try {
  await app.listen({ port, host })
  app.log.info(`generator-service listening on ${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
