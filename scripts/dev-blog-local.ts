import { spawn } from 'node:child_process'
import { ensureLocalBlogEnv } from './blog-local-env'

ensureLocalBlogEnv()

const child = spawn('next', ['dev', '-p', '9002'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PATH: `/usr/local/bin:${process.env.PATH ?? ''}`,
  },
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
