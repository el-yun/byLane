#!/usr/bin/env node
import blessed from 'blessed'
import { createLayout } from './layout.js'
import { createPoller } from './poller.js'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { runCleanup, formatCleanupResult } from '../cleanup.js'
import { writeState } from '../state.js'

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

// 's' — 실행 중인 루프/에이전트 선택 종료
screen.key('s', () => {
  // 루프: running + pid 있는 것
  const loops = Object.entries(lastStates)
    .filter(([name, s]) => name.endsWith('-loop') && s?.status === 'running' && s?.pid)
    .map(([name, s]) => ({ name, type: 'loop', pid: s.pid }))

  // 에이전트: in_progress 상태인 것
  const agents = Object.entries(lastStates)
    .filter(([name, s]) => !name.endsWith('-loop') && !name.endsWith('-queue')
      && s?.status === 'in_progress')
    .map(([name, s]) => ({ name, type: 'agent', task: s.currentTask ?? '' }))

  const items = [...loops, ...agents]

  if (items.length === 0) {
    header.update({
      workflowTitle: '종료할 실행 중 항목 없음',
      time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
    })
    screen.render()
    return
  }

  const listItems = items.map(item =>
    item.type === 'loop'
      ? ` [루프]  ${item.name.padEnd(18)} PID: ${item.pid}`
      : ` [에이전트] ${item.name.padEnd(15)} ${item.task.slice(0, 20)}`
  )

  const list = blessed.list({
    top: 'center',
    left: 'center',
    width: 54,
    height: items.length + 6,
    label: ' 종료할 항목 선택 ',
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'yellow' },
      selected: { bg: 'blue', fg: 'white' },
      item: { fg: 'white' }
    },
    keys: true,
    vi: true,
    mouse: true,
    items: [
      ...listItems,
      '',
      ' {grey-fg}↑↓/jk 이동   Enter 종료   Esc 취소{/}'
    ]
  })

  screen.append(list)
  list.focus()
  screen.render()

  list.on('select', (item, idx) => {
    const target = items[idx]
    if (!target) { screen.remove(list); screen.render(); return }
    let msg

    if (target.type === 'loop') {
      // 루프: SIGTERM
      try {
        process.kill(Number(target.pid), 'SIGTERM')
        msg = `${target.name} 종료 요청됨 (PID: ${target.pid})`
      } catch {
        msg = `${target.name} 종료 실패 (이미 종료됨?)`
      }
    } else {
      // 에이전트: 상태를 cancelled로 기록 + cancel.json 생성
      try {
        const cur = lastStates[target.name] ?? {}
        writeState(target.name, { ...cur, status: 'cancelled', cancelledAt: new Date().toISOString() }, STATE_DIR)
      } catch {}
      // cancel.json 생성 (훅에서 새 Agent 호출 차단)
      if (!existsSync(CANCEL_FILE)) {
        mkdirSync(STATE_DIR, { recursive: true })
        writeFileSync(CANCEL_FILE, JSON.stringify({ cancelledAt: new Date().toISOString() }))
      }
      msg = `${target.name} 취소 요청됨 (Claude 세션에서 완전 종료 필요)`
    }

    header.update({
      workflowTitle: msg,
      time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
    })
    screen.remove(list)
    screen.render()
  })

  list.key(['escape'], () => {
    screen.remove(list)
    screen.render()
  })
})

// 'r' — 상태 정리 (권한 수정, 좀비 초기화, 큐 복구)
screen.key('r', () => {
  header.update({
    workflowTitle: '상태 정리 중...',
    time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
    elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
  })
  screen.render()

  try {
    const result = runCleanup()
    const summary = formatCleanupResult(result)
    const total = Object.values(result).reduce((s, a) => s + a.length, 0)
    header.update({
      workflowTitle: total > 0 ? `정리 완료 (${total}건)` : '정리 완료 — 이상 없음',
      time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
    })
  } catch (e) {
    header.update({
      workflowTitle: `정리 실패: ${e.message}`,
      time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
    })
  }
  screen.render()
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
