#!/usr/bin/env node
import blessed from 'blessed'
import { createLayout } from './layout.js'
import { createPoller } from './poller.js'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'

const { screen, header, pipeline, log, queue, status, onCleanup } = createLayout()
const poller = createPoller()

const startTime = Date.now()
const STATE_DIR = '.bylane/state'
let lastStates = {}
const SUBAGENTS_FILE = join(STATE_DIR, 'subagents.json')
const CANCEL_FILE = join(STATE_DIR, 'cancel.json')

function readSubagents() {
  if (!existsSync(SUBAGENTS_FILE)) return { active: [], recent: [] }
  try { return JSON.parse(readFileSync(SUBAGENTS_FILE, 'utf8')) } catch { return { active: [], recent: [] } }
}

onCleanup(() => poller.stop())

poller.onChange((states) => {
  lastStates = states
  const active = Object.values(states).find(s => s.status === 'in_progress')
  const workflowTitle = active ? (active.currentTask ?? active.agent) : 'Idle'

  header.update({
    workflowTitle,
    time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
    elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
  })
  pipeline.update(states, readSubagents())
  log.update(states)
  queue.update()
  status.update()
})

// 's' — 실행 중인 루프 선택 종료
screen.key('s', () => {
  const runningLoops = Object.entries(lastStates)
    .filter(([name, s]) => name.endsWith('-loop') && s?.status === 'running' && s?.pid)
    .map(([name, s]) => ({ name, pid: s.pid }))

  if (runningLoops.length === 0) {
    header.update({
      workflowTitle: '실행 중인 루프 없음',
      time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
    })
    screen.render()
    return
  }

  // blessed list 오버레이
  const list = blessed.list({
    top: 'center',
    left: 'center',
    width: 40,
    height: runningLoops.length + 4,
    label: ' 종료할 루프 선택 (Enter/Esc) ',
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'yellow' },
      selected: { bg: 'blue', fg: 'white' },
      item: { fg: 'white' }
    },
    keys: true,
    items: runningLoops.map(l => ` ${l.name}  (PID: ${l.pid})`)
  })

  screen.append(list)
  list.focus()
  screen.render()

  list.on('select', (item, idx) => {
    const loop = runningLoops[idx]
    try {
      process.kill(loop.pid, 'SIGTERM')
      header.update({
        workflowTitle: `${loop.name} 종료 요청됨 (PID: ${loop.pid})`,
        time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
      })
    } catch {
      header.update({
        workflowTitle: `${loop.name} 종료 실패 (이미 종료됨?)`,
        time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
      })
    }
    screen.remove(list)
    screen.render()
  })

  list.key(['escape', 'q'], () => {
    screen.remove(list)
    screen.render()
  })
})

// 'c' — 하위 에이전트 취소 플래그 토글
screen.key('c', () => {
  if (existsSync(CANCEL_FILE)) {
    unlinkSync(CANCEL_FILE)
    header.update({
      workflowTitle: '에이전트 취소 해제',
      time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
    })
  } else {
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(CANCEL_FILE, JSON.stringify({ cancelledAt: new Date().toISOString() }))
    header.update({
      workflowTitle: '!! 에이전트 취소 요청됨 !!',
      time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
    })
  }
  screen.render()
})

screen.render()
