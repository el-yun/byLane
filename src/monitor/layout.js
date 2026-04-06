import blessed from 'blessed'
import { createHeader } from './panels/header.js'
import { createPipelinePanel } from './panels/pipeline.js'
import { createLogPanel } from './panels/log.js'
import { createQueuePanel } from './panels/queue.js'
import { createStatusPanel } from './panels/status.js'

export function createLayout() {
  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    dockBorders: true,
    title: 'byLane Monitor'
  })

  // 최소 크기 경고 오버레이
  const tooSmall = blessed.box({
    top: 'center',
    left: 'center',
    width: 40,
    height: 5,
    content: '\n  터미널이 너무 작습니다.\n  최소 80×24 이상으로 키워주세요.',
    align: 'center',
    tags: true,
    border: { type: 'line' },
    style: { fg: 'white', bg: 'red', border: { fg: 'white' } },
    hidden: true
  })
  screen.append(tooSmall)

  function checkSize() {
    const cols = screen.width
    const rows = screen.height
    if (cols < 80 || rows < 24) {
      tooSmall.show()
    } else {
      tooSmall.hide()
    }
    screen.render()
  }

  screen.on('resize', () => {
    // 약간의 지연으로 tmux/pane 리사이즈 완료 후 렌더링
    setTimeout(() => {
      screen.alloc()
      screen.render()
      checkSize()
    }, 50)
  })

  // 초기 크기 체크
  process.nextTick(checkSize)

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
    content: ' [q]종료  [c]에이전트취소토글  [Tab]포커스  [j/k]로그스크롤',
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
