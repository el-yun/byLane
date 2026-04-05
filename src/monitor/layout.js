import blessed from 'blessed'
import { createHeader } from './panels/header.js'
import { createPipelinePanel } from './panels/pipeline.js'
import { createLogPanel } from './panels/log.js'
import { createQueuePanel } from './panels/queue.js'
import { createStatusPanel } from './panels/status.js'

export function createLayout() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'byLane Monitor'
  })

  const header = createHeader(screen)
  const pipeline = createPipelinePanel(screen)
  const log = createLogPanel(screen)
  const queue = createQueuePanel(screen)
  const status = createStatusPanel(screen)

  const footer = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' [q]종료  [p]일시정지  [c]작업취소  [Tab]포커스  [j/k]로그스크롤  [?]도움말',
    style: { fg: 'black', bg: 'cyan' }
  })
  screen.append(footer)

  let cleanupFn = null
  screen.key(['q', 'C-c'], () => {
    if (cleanupFn) cleanupFn()
    process.exit(0)
  })

  return { screen, header, pipeline, log, queue, status, onCleanup(fn) { cleanupFn = fn } }
}
