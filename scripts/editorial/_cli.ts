export function readOption(name: string) {
  const args = process.argv.slice(2)
  const prefixed = `--${name}=`

  for (let index = 0; index < args.length; index++) {
    const current = args[index]
    if (current === `--${name}`) {
      return args[index + 1]
    }
    if (current.startsWith(prefixed)) {
      return current.slice(prefixed.length)
    }
  }

  return undefined
}

export function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`)
}

export function requireOption(name: string) {
  const value = readOption(name)
  if (!value) {
    throw new Error(`Missing required option --${name}`)
  }
  return value
}

