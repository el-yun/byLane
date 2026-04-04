import { watch } from 'chokidar'
import { listStates } from '../state.js'

export function createPoller(stateDir = '.bylane/state', intervalMs = 1000) {
  const callbacks = new Set()

  const emit = () => {
    const states = {}
    for (const s of listStates(stateDir)) {
      states[s.agent] = s
    }
    for (const cb of callbacks) cb(states)
  }

  const watcher = watch(`${stateDir}`, { persistent: true, ignoreInitial: false })
  watcher.on('change', emit)
  watcher.on('add', emit)

  const interval = setInterval(emit, intervalMs)

  return {
    onChange(cb) { callbacks.add(cb) },
    stop() {
      clearInterval(interval)
      watcher.close()
    }
  }
}
