import blessed from 'blessed'
import { existsSync, readFileSync } from 'fs'

export function createQueuePanel(screen) {
  const box = blessed.box({
    top: '60%',
    left: 0,
    width: '50%',
    height: '40%',
    label: ' QUEUE ',
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } }
  })
  screen.append(box)

  return {
    update() {
      const queuePath = '.bylane/queue.json'
      const queue = existsSync(queuePath)
        ? JSON.parse(readFileSync(queuePath, 'utf8'))
        : []
      const header = ` ${'#'.padEnd(3)} ${'TYPE'.padEnd(12)} ${'TARGET'.padEnd(10)} STATUS`
      const rows = queue.slice(0, 8).map((item, i) =>
        ` ${String(i + 1).padEnd(3)} ${(item.type ?? '').padEnd(12)} ${(item.target ?? '').padEnd(10)} ${item.status ?? ''}`
      )
      box.setContent([header, ...rows].join('\n'))
      screen.render()
    }
  }
}
