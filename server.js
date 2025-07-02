import { createServer } from 'https'
import { parse } from 'url'
import next from 'next'
import fs from 'fs'

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = 3000

const app = next({ dev, hostname, port: 3001 })
const handle = app.getRequestHandler()

const httpsOptions = {
  key: fs.readFileSync('./.next-ssl/key.pem'),
  cert: fs.readFileSync('./.next-ssl/cert.pem'),
}

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    const parsedUrl = parse(req.url, true)
    await handle(req, res, parsedUrl)
  }).listen(port, hostname, (err) => {
    if (err) throw err
    console.log(`> Ready on https://${hostname}:${port}`)
  })
})