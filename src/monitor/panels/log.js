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

  return {
    update(states) {
      const newLines = []
      for (const state of Object.values(states)) {
        for (const entry of (state.log ?? []).slice(-5)) {
          const ts = new Date(entry.ts).toLocaleTimeString('ko-KR', { hour12: false })
          newLines.push(` ${ts} {cyan-fg}${state.agent}{/cyan-fg}`)
          newLines.push(`   > ${entry.msg}`)
        }
      }
      const all = [...lines, ...newLines].slice(-50)
      lines.length = 0
      lines.push(...all)
      box.setContent(lines.join('\n'))
      box.scrollTo(lines.length)
      screen.render()
    }
  }
}
