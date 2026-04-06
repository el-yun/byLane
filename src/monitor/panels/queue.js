import blessed from 'blessed'
import { existsSync, readFileSync } from 'fs'

function readQueue(path) {
  if (!existsSync(path)) return []
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    return data.queue ?? []
  } catch {
    return []
  }
}

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
      const reviewItems = readQueue('.bylane/state/review-queue.json')
        .map(p => ({ type: 'review', target: `PR #${p.number}`, status: p.status ?? '' }))
      const respondItems = readQueue('.bylane/state/respond-queue.json')
        .map(p => ({ type: 'respond', target: `PR #${p.number}`, status: p.status ?? '' }))

      const all = [...reviewItems, ...respondItems]
      const header = ` ${'#'.padEnd(3)} ${'TYPE'.padEnd(10)} ${'TARGET'.padEnd(10)} STATUS`
      const rows = all.slice(0, 8).map((item, i) =>
        ` ${String(i + 1).padEnd(3)} ${item.type.padEnd(10)} ${item.target.padEnd(10)} ${item.status}`
      )
      const content = all.length === 0
        ? [header, ' 대기 중인 항목 없음']
        : [header, ...rows]
      box.setContent(content.join('\n'))
      screen.render()
    }
  }
}
