import blessed from 'blessed'

export function createHeader(screen) {
  const box = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    content: ' byLane Monitor   Idle   --:--:--',
    tags: true,
    border: { type: 'line' },
    style: { fg: 'white', bg: 'blue', border: { fg: 'cyan' } }
  })
  screen.append(box)

  return {
    update({ workflowTitle, elapsed, time }) {
      const title = workflowTitle ?? 'Idle'
      const elapsedStr = elapsed ?? ''
      box.setContent(` {bold}byLane Monitor{/bold}   ${title}   ${elapsedStr}  ${time}`)
      screen.render()
    }
  }
}
