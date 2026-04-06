import blessed from 'blessed'

export function createLogPanel(screen) {
  const box = blessed.box({
    top: 3,
    left: '50%',
    width: '50%',
    height: '60%-3',
    label: ' AGENT LOG  [LIVE] ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } },
    keys: true,
    vi: true
  })
  screen.append(box)

  const lines = []
  const seen = new Set()

  return {
    update(states) {
      let changed = false
      for (const state of Object.values(states)) {
        for (const entry of (state.log ?? [])) {
          const key = `${state.agent}:${entry.ts}`
          if (seen.has(key)) continue
          seen.add(key)
          const ts = new Date(entry.ts).toLocaleTimeString('ko-KR', { hour12: false })
          lines.push(` ${ts} {cyan-fg}${state.agent}{/cyan-fg}`)
          lines.push(`   > ${entry.msg}`)
          changed = true
        }
      }
      if (changed) {
        if (lines.length > 200) lines.splice(0, lines.length - 200)
        box.setContent(lines.join('\n'))
        box.scrollTo(lines.length)
        screen.render()
      }
    }
  }
}
