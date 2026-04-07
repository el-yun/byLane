/**
 * loop-utils.js
 * 루프 프로세스 공통 유틸
 */
import { execSync } from 'child_process'
import { readState, writeState } from './state.js'
import { loadConfig } from './config.js'

/**
 * 동일 루프가 이미 실행 중이면 기존 프로세스를 종료하고 기다린다.
 * @param {string} loopName  e.g. 'review-loop'
 * @param {string} stateDir
 */
export function killExistingLoop(loopName, stateDir = '.bylane/state') {
  const existing = readState(loopName, stateDir)
  if (!existing || existing.status !== 'running' || !existing.pid) return

  const pid = Number(existing.pid)
  if (pid === process.pid) return   // 자기 자신이면 무시

  // PID가 살아있는지 확인
  try {
    process.kill(pid, 0)
  } catch {
    // 이미 종료된 프로세스 — 상태만 정리
    writeState(loopName, { ...existing, status: 'stopped', stoppedAt: new Date().toISOString() }, stateDir)
    return
  }

  // 기존 프로세스 종료
  console.log(`[${loopName}] 기존 프로세스(PID: ${pid}) 종료 후 재시작합니다.`)
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // 종료 실패 시 무시하고 계속
  }

  // 최대 2초 대기 (100ms 간격 폴링)
  const deadline = Date.now() + 2000
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
      execSync('sleep 0.1')
    } catch {
      break  // 종료 완료
    }
  }
}

/**
 * 루프 프로세스의 PID를 반환한다.
 * state 파일 → pgrep fallback 순서로 탐색.
 * @param {string} loopName  e.g. 'review-loop'
 * @param {string} stateDir
 * @returns {{ pid: number, source: 'state' | 'pgrep' } | null}
 */
export function findLoopPid(loopName, stateDir = '.bylane/state') {
  // 1) state 파일에서 PID 확인
  const state = readState(loopName, stateDir)
  if (state?.pid) {
    const pid = Number(state.pid)
    try {
      process.kill(pid, 0)
      return { pid, source: 'state' }
    } catch {
      // PID가 있지만 이미 죽었으면 pgrep으로 재시도
    }
  }

  // 2) pgrep으로 프로세스명 검색
  const scriptFile = `${loopName}.js`
  try {
    const result = execSync(`pgrep -f "${scriptFile}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    if (result) {
      // 여러 PID가 있을 수 있음 — 첫 번째 사용
      const pid = Number(result.split('\n')[0])
      if (pid && pid !== process.pid) return { pid, source: 'pgrep' }
    }
  } catch {
    // pgrep 결과 없음
  }

  return null
}

/**
 * tmux 세션이 살아있는지 확인
 * @param {string} sessionName
 * @returns {boolean}
 */
export function isTmuxSessionAlive(sessionName) {
  try {
    execSync(`tmux has-session -t ${sessionName}`, { stdio: ['pipe', 'pipe', 'pipe'] })
    return true
  } catch {
    return false
  }
}

/**
 * tmux 세션의 두 루프가 정상 기동됐는지 검증한다.
 * state 파일에 running 상태가 기록될 때까지 최대 timeoutMs 대기.
 * @param {string} sessionName
 * @param {string} stateDir
 * @param {number} timeoutMs
 * @returns {{ ok: boolean, review: object, respond: object }}
 */
export function verifyTmuxLoops(sessionName = 'bylane-loops', stateDir = '.bylane/state', timeoutMs = 8000) {
  const loops = ['review-loop', 'respond-loop']
  const result = {}

  // 1. tmux 세션 및 윈도우 존재 확인
  if (!isTmuxSessionAlive(sessionName)) {
    return { ok: false, review: { alive: false }, respond: { alive: false } }
  }

  let windows = []
  try {
    const out = execSync(
      `tmux list-windows -t ${sessionName} -F '#{window_name}'`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim()
    windows = out.split('\n').map(w => w.trim())
  } catch { /* 세션이 막 종료됐을 수 있음 */ }

  // 2. 각 루프의 state 파일이 running 상태가 될 때까지 폴링
  const deadline = Date.now() + timeoutMs
  const pending = new Set(loops)

  while (pending.size > 0 && Date.now() < deadline) {
    for (const loop of [...pending]) {
      const state = readState(loop, stateDir)
      if (state?.status === 'running' && state?.pid) {
        result[loop] = { alive: true, pid: state.pid, startedAt: state.startedAt }
        pending.delete(loop)
      }
    }
    if (pending.size > 0) execSync('sleep 0.5')
  }

  // 타임아웃된 루프는 실패로 처리
  for (const loop of pending) {
    const windowName = loop.replace('-loop', '')
    const windowAlive = windows.includes(windowName)
    result[loop] = { alive: false, windowAlive }
  }

  const ok = loops.every(l => result[l]?.alive)
  return { ok, review: result['review-loop'], respond: result['respond-loop'] }
}

/**
 * tmux 세션에서 review-loop + respond-loop을 실행
 * @param {string} sessionName
 * @param {string} stateDir
 */
export function startTmuxLoops(sessionName = 'bylane-loops', stateDir = '.bylane/state') {
  if (isTmuxSessionAlive(sessionName)) {
    console.log(`[tmux] 세션 '${sessionName}'이 이미 실행 중입니다.`)
    return { started: false, reason: 'already_running' }
  }

  // 첫 번째 윈도우: review-loop
  execSync(
    `tmux new-session -d -s ${sessionName} -n review 'node src/review-loop.js'`,
    { stdio: 'inherit' }
  )
  // 두 번째 윈도우: respond-loop
  execSync(
    `tmux new-window -t ${sessionName} -n respond 'node src/respond-loop.js'`,
    { stdio: 'inherit' }
  )

  console.log(`[tmux] 세션 '${sessionName}' 시작 — 루프 기동 확인 중...`)
  const verification = verifyTmuxLoops(sessionName, stateDir)

  if (verification.ok) {
    console.log(`[tmux] review-loop (PID: ${verification.review.pid}) ✓`)
    console.log(`[tmux] respond-loop (PID: ${verification.respond.pid}) ✓`)
  } else {
    const reviewStatus = verification.review?.alive ? `✓ PID: ${verification.review.pid}` : `✗ 기동 실패 (창: ${verification.review?.windowAlive ? '있음' : '없음'})`
    const respondStatus = verification.respond?.alive ? `✓ PID: ${verification.respond.pid}` : `✗ 기동 실패 (창: ${verification.respond?.windowAlive ? '있음' : '없음'})`
    console.log(`[tmux] review-loop  ${reviewStatus}`)
    console.log(`[tmux] respond-loop ${respondStatus}`)
    console.log(`[tmux] 일부 루프가 정상 기동되지 않았습니다. tmux attach -t ${sessionName} 으로 확인하세요.`)
  }

  return { started: true, sessionName, verified: verification.ok, verification }
}

/**
 * tmux 세션 종료
 * @param {string} sessionName
 */
export function stopTmuxLoops(sessionName = 'bylane-loops') {
  if (!isTmuxSessionAlive(sessionName)) {
    console.log(`[tmux] 세션 '${sessionName}'이 존재하지 않습니다.`)
    return { stopped: false, reason: 'not_running' }
  }

  execSync(`tmux kill-session -t ${sessionName}`, { stdio: 'inherit' })
  console.log(`[tmux] 세션 '${sessionName}' 종료 완료`)
  return { stopped: true, sessionName }
}

/**
 * 절대 시간 기반 폴링 타이머.
 * setInterval과 달리 잠자기 모드 후 깨어났을 때 즉시 보정한다.
 * @param {() => void | Promise<void>} fn  폴링 콜백
 * @param {number} intervalMs  폴링 간격 (ms)
 * @param {number} [checkMs=10000]  체크 주기 (ms)
 * @returns {{ timer: NodeJS.Timeout, stop: () => void }}
 */
export function createAbsoluteTimer(fn, intervalMs, checkMs = 10000) {
  let lastRun = Date.now()

  const timer = setInterval(async () => {
    const now = Date.now()
    if (now - lastRun >= intervalMs) {
      lastRun = now
      await fn()
    }
  }, checkMs)

  return {
    timer,
    stop() { clearInterval(timer) }
  }
}

/**
 * 현재 설정에서 loop 모드를 결정한다.
 * tmux 모드인데 tmux가 없으면 process로 fallback.
 * @returns {'tmux' | 'process'}
 */
export function resolveLoopMode() {
  const config = loadConfig()
  const mode = config.loop?.mode ?? 'tmux'

  if (mode === 'tmux') {
    try {
      execSync('which tmux', { stdio: ['pipe', 'pipe', 'pipe'] })
      execSync('tmux -V', { stdio: ['pipe', 'pipe', 'pipe'] })
      return 'tmux'
    } catch {
      console.log('[loop] tmux를 사용할 수 없음 — process 모드로 fallback합니다.')
      return 'process'
    }
  }

  return 'process'
}
