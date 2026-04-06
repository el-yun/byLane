#!/usr/bin/env node
import { createLayout } from './layout.js'
import { createPoller } from './poller.js'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'

const { screen, header, pipeline, log, queue, status, onCleanup } = createLayout()
const poller = createPoller()

const startTime = Date.now()
const STATE_DIR = '.bylane/state'
const SUBAGENTS_FILE = join(STATE_DIR, 'subagents.json')
const CANCEL_FILE = join(STATE_DIR, 'cancel.json')

function readSubagents() {
  if (!existsSync(SUBAGENTS_FILE)) return { active: [], recent: [] }
  try { return JSON.parse(readFileSync(SUBAGENTS_FILE, 'utf8')) } catch { return { active: [], recent: [] } }
}

onCleanup(() => poller.stop())

poller.onChange((states) => {
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

// 'c' — 하위 에이전트 취소 플래그 토글
const cancelLabel = () => existsSync(CANCEL_FILE) ? '[취소 활성]' : ''
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
