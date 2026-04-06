#!/usr/bin/env node
/**
 * bylane-agent-tracker.js
 * PreToolUse / PostToolUse 훅 — Agent 도구 호출을 추적하고 취소 플래그를 검사한다.
 *
 * 등록 방법 (npx @elyun/bylane 이 자동 등록):
 *   settings.json > hooks > PreToolUse  : node .../bylane-agent-tracker.js pre
 *   settings.json > hooks > PostToolUse : node .../bylane-agent-tracker.js post
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const hookType = process.argv[2] ?? 'pre'   // 'pre' | 'post'
const STATE_DIR = '.bylane/state'
const SUBAGENTS_FILE = join(STATE_DIR, 'subagents.json')
const CANCEL_FILE = join(STATE_DIR, 'cancel.json')

let input
try {
  input = JSON.parse(readFileSync('/dev/stdin', 'utf8'))
} catch {
  process.exit(0)
}

const { session_id, tool_name, tool_input, tool_result } = input

// Agent 도구 호출만 처리
if (tool_name !== 'Agent') process.exit(0)

function readSubagents() {
  if (!existsSync(SUBAGENTS_FILE)) return { active: [], recent: [] }
  try { return JSON.parse(readFileSync(SUBAGENTS_FILE, 'utf8')) } catch { return { active: [], recent: [] } }
}

function writeSubagents(data) {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(SUBAGENTS_FILE, JSON.stringify(data, null, 2))
}

if (hookType === 'pre') {
  // 취소 플래그 확인 → 있으면 에이전트 실행 차단
  if (existsSync(CANCEL_FILE)) {
    const out = JSON.stringify({
      decision: 'block',
      reason: '사용자가 에이전트 실행을 취소했습니다. (byLane monitor에서 [c] 키로 설정됨)'
    })
    process.stdout.write(out)
    process.exit(0)
  }

  // 신규 하위 에이전트 기록
  const data = readSubagents()
  const entry = {
    id: `${session_id}-${Date.now()}`,
    sessionId: session_id,
    subagentType: tool_input?.subagent_type ?? 'general-purpose',
    prompt: (tool_input?.prompt ?? '').slice(0, 120),
    status: 'running',
    startedAt: new Date().toISOString()
  }
  data.active.push(entry)
  // active는 최대 20개 유지
  if (data.active.length > 20) data.active.shift()
  writeSubagents(data)

} else if (hookType === 'post') {
  // 완료 처리 — active → recent 이동
  const data = readSubagents()
  const idx = [...data.active].reverse()
    .findIndex(a => a.sessionId === session_id && a.status === 'running')

  if (idx !== -1) {
    const realIdx = data.active.length - 1 - idx
    const agent = { ...data.active[realIdx], status: 'completed', completedAt: new Date().toISOString() }
    data.active.splice(realIdx, 1)
    data.recent.unshift(agent)
    // recent는 최대 10개 유지
    if (data.recent.length > 10) data.recent.pop()
    writeSubagents(data)
  }
}

process.exit(0)
