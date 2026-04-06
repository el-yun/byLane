/**
 * loop-utils.js
 * 루프 프로세스 공통 유틸
 */
import { execSync } from 'child_process'
import { readState, writeState } from './state.js'

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
