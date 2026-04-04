import { readFileSync, writeFileSync, unlinkSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const DEFAULT_DIR = '.bylane/state'

export function writeState(agentName, data, dir = DEFAULT_DIR) {
  mkdirSync(dir, { recursive: true })
  const payload = {
    ...data,
    agent: agentName,
    updatedAt: new Date().toISOString(),
    log: data.log ?? []
  }
  writeFileSync(join(dir, `${agentName}.json`), JSON.stringify(payload, null, 2))
}

export function readState(agentName, dir = DEFAULT_DIR) {
  const path = join(dir, `${agentName}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function clearState(agentName, dir = DEFAULT_DIR) {
  const path = join(dir, `${agentName}.json`)
  if (existsSync(path)) unlinkSync(path)
}

export function listStates(dir = DEFAULT_DIR) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => readState(f.replace('.json', ''), dir))
    .filter(Boolean)
}

export function appendLog(agentName, message, dir = DEFAULT_DIR) {
  const state = readState(agentName, dir) ?? { agent: agentName, status: 'idle', log: [] }
  const entry = { ts: new Date().toISOString(), msg: message }
  writeState(agentName, { ...state, log: [...(state.log ?? []), entry] }, dir)
}
