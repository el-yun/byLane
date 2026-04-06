/**
 * cleanup.js
 * 상태 파일 정리, 권한 수정, 좀비 프로세스/에이전트 초기화
 * monitor [r] 키 또는 `npx @elyun/bylane cleanup`으로 실행
 */
import { readdirSync, chmodSync, existsSync, unlinkSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { readState, writeState } from './state.js'
import { gcQueue, expireStaleItems } from './queue-utils.js'
import { cancelStalePipeline, blockDownstreamOfFailed } from './pipeline.js'

const STATE_DIR = '.bylane/state'
const STALE_MS = 30 * 60 * 1000   // 30분 이상 in_progress → 초기화
const SUBAGENTS_FILE = join(STATE_DIR, 'subagents.json')

/** 프로세스가 살아있는지 확인 (kill -0) */
function isPidAlive(pid) {
  try {
    process.kill(Number(pid), 0)
    return true
  } catch {
    return false
  }
}

/** subagents.json에서 죽은 PID 제거 */
function cleanSubagents() {
  if (!existsSync(SUBAGENTS_FILE)) return []
  let data
  try { data = JSON.parse(readFileSync(SUBAGENTS_FILE, 'utf8')) } catch { return [] }

  const before = (data.active ?? []).length
  const active = (data.active ?? []).filter(a => {
    if (!a.pid) return false
    return isPidAlive(a.pid)
  })
  const cleaned = before - active.length

  if (cleaned > 0) {
    writeFileSync(SUBAGENTS_FILE, JSON.stringify({ ...data, active }, null, 2))
  }
  return cleaned > 0 ? [`subagents.json: active ${before}개 → ${active.length}개 (${cleaned}개 제거)`] : []
}

/** 디렉토리 및 파일 권한 수정 */
function fixPermissions() {
  const fixed = []
  try {
    chmodSync(STATE_DIR, 0o755)
  } catch {}

  const files = existsSync(STATE_DIR)
    ? readdirSync(STATE_DIR).filter(f => f.endsWith('.json'))
    : []

  for (const file of files) {
    try {
      chmodSync(join(STATE_DIR, file), 0o644)
    } catch (e) {
      fixed.push(`권한 수정 실패: ${file} — ${e.message}`)
    }
  }
  return fixed
}

/**
 * 전체 정리 실행
 * @returns {{ fixed: string[], killed: string[], reset: string[], cleared: string[] }}
 */
export function runCleanup() {
  const result = { fixed: [], killed: [], reset: [], cleared: [] }

  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true })
    return result
  }

  // 0. 파이프라인 cascade cancel — stale 파이프라인 감지 시 하위 에이전트 일괄 취소
  const stalePipeline = cancelStalePipeline()
  if (stalePipeline.pipelineCancelled) {
    result.reset.push(`pipeline: stale → cancelled (${stalePipeline.cancelled.length}개 에이전트 취소: ${stalePipeline.cancelled.join(', ')})`)
  }

  // 0-1. 파이프라인 내 실패 에이전트 하류 → blocked
  const downstream = blockDownstreamOfFailed()
  if (downstream.blocked.length > 0) {
    result.reset.push(`pipeline: upstream 실패 → ${downstream.blocked.length}개 에이전트 blocked (${downstream.blocked.join(', ')})`)
  }

  // 1. 파일 권한 수정
  result.fixed.push(...fixPermissions())

  // 2. 상태 파일 순회
  const files = readdirSync(STATE_DIR).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const name = file.replace('.json', '')

    // 특수 파일 건너뜀 (pipeline은 pipeline.js에서 별도 처리)
    if (name === 'cancel' || name === 'pipeline') continue

    // subagents 별도 처리
    if (name === 'subagents') {
      result.cleared.push(...cleanSubagents())
      continue
    }

    const state = readState(name, STATE_DIR)
    if (!state) continue

    // 루프: PID가 죽었으면 stopped로 전환
    if (name.endsWith('-loop') && state.pid && state.status === 'running') {
      if (!isPidAlive(state.pid)) {
        writeState(name, { ...state, status: 'stopped', stoppedAt: new Date().toISOString() }, STATE_DIR)
        result.killed.push(`${name}: PID ${state.pid} 없음 → stopped`)
      }
    }

    // in_progress 상태가 30분 이상 → failed로 초기화
    if (state.status === 'in_progress' && state.startedAt) {
      const age = Date.now() - new Date(state.startedAt).getTime()
      if (age > STALE_MS) {
        writeState(name, {
          ...state,
          status: 'failed',
          error: `stale: ${Math.floor(age / 60000)}분 초과 in_progress`
        }, STATE_DIR)
        result.reset.push(`${name}: ${Math.floor(age / 60000)}분 in_progress → failed`)
      }
    }

    // 큐 파일 종합 정리
    if ((name === 'review-queue' || name === 'respond-queue') && Array.isArray(state.queue)) {
      let queue = state.queue
      let changed = false

      // 1) responding/reviewing 상태 → pending 복구
      const recovered = queue.map(item =>
        item.status === 'reviewing' || item.status === 'responding'
          ? { ...item, status: 'pending', recoveredAt: new Date().toISOString() }
          : item
      )
      const recoveredCount = recovered.filter((item, i) => item.status !== queue[i].status).length
      if (recoveredCount > 0) {
        queue = recovered
        changed = true
        result.reset.push(`${name}: ${recoveredCount}개 진행중 항목 → pending 복구`)
      }

      // 2) stale pending → expired (TTL 초과)
      const expired = expireStaleItems(queue)
      if (expired.expiredCount > 0) {
        queue = expired.queue
        changed = true
        result.reset.push(`${name}: ${expired.expiredCount}개 pending 항목 → expired (TTL 초과)`)
      }

      // 3) resolved/expired 항목 GC (1시간 경과)
      const gc = gcQueue(queue)
      if (gc.removedCount > 0) {
        queue = gc.queue
        changed = true
        result.cleared.push(`${name}: ${gc.removedCount}개 완료/만료 항목 GC 제거`)
      }

      // 4) 루프-큐 상태 동기화: 루프가 stopped인데 큐가 running이면 stopped로
      const loopName = name.replace('-queue', '-loop')
      const loopState = readState(loopName, STATE_DIR)
      const loopDead = !loopState || loopState.status !== 'running' ||
        (loopState.pid && !isPidAlive(loopState.pid))
      if (state.status === 'running' && loopDead) {
        changed = true
        result.reset.push(`${name}: 루프 미실행 → 큐 상태 stopped`)
      }

      if (changed) {
        const newStatus = (state.status === 'running' && loopDead) ? 'stopped' : state.status
        writeState(name, { ...state, status: newStatus, queue }, STATE_DIR)
      }
    }
  }

  return result
}

/** 결과를 사람이 읽기 쉬운 문자열로 출력 */
export function formatCleanupResult(result) {
  const lines = []
  const total = Object.values(result).reduce((s, arr) => s + arr.length, 0)

  if (total === 0) {
    lines.push('정리할 항목 없음.')
    return lines.join('\n')
  }

  if (result.killed.length)  lines.push('  [종료]', ...result.killed.map(s => `    · ${s}`))
  if (result.reset.length)   lines.push('  [초기화]', ...result.reset.map(s => `    · ${s}`))
  if (result.cleared.length) lines.push('  [정리]', ...result.cleared.map(s => `    · ${s}`))
  if (result.fixed.length)   lines.push('  [오류]', ...result.fixed.map(s => `    · ${s}`))

  return lines.join('\n')
}
