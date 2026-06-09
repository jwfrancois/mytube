#!/usr/bin/env bun
// Persistent Next.js dev server that survives shell session termination
import { spawn } from 'child_process'
import { writeFileSync, appendFileSync } from 'fs'

const LOG_FILE = '/home/z/my-project/dev.log'
const PID_FILE = '/home/z/my-project/.next-dev.pid'

writeFileSync(LOG_FILE, '')
writeFileSync(PID_FILE, String(process.pid))

const child = spawn('npx', ['next', 'dev', '-p', '3000'], {
  cwd: '/home/z/my-project',
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false,
  env: { ...process.env },
})

child.stdout.on('data', (data) => {
  appendFileSync(LOG_FILE, data.toString())
})

child.stderr.on('data', (data) => {
  appendFileSync(LOG_FILE, data.toString())
})

child.on('exit', (code) => {
  appendFileSync(LOG_FILE, `\nServer exited with code ${code}\n`)
})

// Keep alive
process.on('SIGTERM', () => {
  child.kill()
  process.exit(0)
})

// Prevent the script from exiting
setInterval(() => {}, 60000)
