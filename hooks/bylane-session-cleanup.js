#!/usr/bin/env node
/**
 * bylane-session-cleanup.js
 * Stop 훅 — Claude Code 세션 종료 시 상태 파일 자동 정리
 *
 * 처리 항목:
 * - in_progress 에이전트 → cancelled (세션 종료)
 * - running 루프 (PID 죽은 경우) → stopped
 * - running 큐 (루프 죽은 경우) → stopped
 * - pipeline in_progress → cancelled
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs'

// stdin 읽기 (훅 프로토콜)
try { readFileSync('/dev/stdin', 'utf8') } catch {}

const STATE_DIR = '.bylane/state'
if (!existsSync(STATE_DIR)) process.exit(0)

const now = new Date().toISOString()

function isPidAlive(pid) {
  try { process.kill(Number(pid), 0); return true } catch { return false }
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify({ ...data, updatedAt: now }, null, 2))
}

try {
  const files = readdirSync(STATE_DIR).filter(f => f.endsWith('.json'))
  const { join } = await import('path')

  for (const file of files) {
    const name = file.replace('.json', '')
    if (name === 'cancel' || name === 'subagents') continue

    const path = join(STATE_DIR, file)
    const state = readJson(path)
    if (!state) continue

    // 파이프라인: in_progress → cancelled + 하위 step도 cancelled
    if (name === 'pipeline' && state.status === 'in_progress') {
      writeJson(path, {
        ...state,
        status: 'cancelled',
        cancelledAt: now,
        reason: 'session_ended',
        steps: (state.steps ?? []).map(step =>
          step.status === 'in_progress' || step.status === 'pending'
            ? { ...step, status: 'cancelled', cancelledAt: now }
            : step
        )
      })
      continue
    }

    // in_progress 에이전트 → cancelled
    if (state.status === 'in_progress' && !name.endsWith('-loop') && !name.endsWith('-queue')) {
      writeJson(path, {
        ...state,
        status: 'cancelled',
        cancelledAt: now,
        reason: 'session_ended'
      })
      continue
    }

    // running 루프: PID 죽었으면 stopped
    if (name.endsWith('-loop') && state.status === 'running' && state.pid) {
      if (!isPidAlive(state.pid)) {
        writeJson(path, { ...state, status: 'stopped', stoppedAt: now })
      }
      continue
    }

    // running 큐: 대응 루프가 죽었으면 stopped
    if (name.endsWith('-queue') && state.status === 'running') {
      const loopName = name.replace('-queue', '-loop')
      const loopPath = join(STATE_DIR, `${loopName}.json`)
      const loopState = readJson(loopPath)
      const loopAlive = loopState?.status === 'running' && loopState?.pid && isPidAlive(loopState.pid)
      if (!loopAlive) {
        writeJson(path, { ...state, status: 'stopped' })
      }
    }
  }
} catch {}

process.exit(0)
