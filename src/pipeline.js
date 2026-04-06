/**
 * pipeline.js
 * 에이전트 파이프라인 상태 추적 및 cascade cancel
 */
import { readState, writeState } from './state.js'

const STATE_DIR = '.bylane/state'

/** 파이프라인별 에이전트 실행 순서 */
export const PIPELINES = {
  A: ['issue-agent', 'code-agent', 'test-agent', 'commit-agent', 'pr-agent', 'review-agent', 'notify-agent'],
  B: ['code-agent', 'test-agent', 'commit-agent', 'pr-agent', 'review-agent', 'notify-agent'],
  C_review: ['review-agent'],
  C_respond: ['respond-agent'],
  D: []   // 단일 에이전트, 동적 지정
}

/** 파이프라인 상태 기록 기본 TTL (30분) */
export const PIPELINE_STALE_MS = 30 * 60 * 1000

/**
 * 파이프라인 시작 기록
 * @param {{ type: string, issueNumber?: number, steps: string[] }} opts
 */
export function startPipeline({ type, issueNumber, steps }) {
  const now = new Date().toISOString()
  writeState('pipeline', {
    status: 'in_progress',
    pipelineType: type,
    issueNumber: issueNumber ?? null,
    startedAt: now,
    currentStep: steps[0] ?? null,
    steps: steps.map(agent => ({ agent, status: 'pending' }))
  }, STATE_DIR)
}

/**
 * 현재 파이프라인 단계 업데이트
 * @param {string} agentName
 * @param {'in_progress'|'completed'|'failed'} status
 */
export function updatePipelineStep(agentName, status) {
  const pipeline = readState('pipeline', STATE_DIR)
  if (!pipeline || pipeline.status !== 'in_progress') return

  const steps = (pipeline.steps ?? []).map(step =>
    step.agent === agentName
      ? { ...step, status, [`${status}At`]: new Date().toISOString() }
      : step
  )

  // 다음 단계 결정
  const currentIdx = steps.findIndex(s => s.agent === agentName)
  const nextStep = (status === 'completed' && currentIdx < steps.length - 1)
    ? steps[currentIdx + 1].agent
    : null

  // 전체 완료 여부
  const allDone = steps.every(s => s.status === 'completed')
  const anyFailed = steps.some(s => s.status === 'failed')

  writeState('pipeline', {
    ...pipeline,
    status: allDone ? 'completed' : anyFailed ? 'failed' : 'in_progress',
    currentStep: nextStep ?? pipeline.currentStep,
    steps
  }, STATE_DIR)
}

/**
 * 파이프라인 완료 처리
 */
export function completePipeline() {
  const pipeline = readState('pipeline', STATE_DIR)
  if (!pipeline) return
  writeState('pipeline', {
    ...pipeline,
    status: 'completed',
    completedAt: new Date().toISOString()
  }, STATE_DIR)
}

/**
 * 활성 파이프라인 조회
 * @returns {Object|null}
 */
export function getActivePipeline() {
  const pipeline = readState('pipeline', STATE_DIR)
  if (!pipeline || pipeline.status !== 'in_progress') return null
  return pipeline
}

/**
 * stale 파이프라인 감지 및 cascade cancel.
 * 파이프라인이 staleMs 동안 업데이트 없으면 하위 에이전트를 모두 cancelled 처리한다.
 *
 * @param {number} [staleMs=PIPELINE_STALE_MS]
 * @returns {{ cancelled: string[], pipelineCancelled: boolean }}
 */
export function cancelStalePipeline(staleMs = PIPELINE_STALE_MS) {
  const pipeline = readState('pipeline', STATE_DIR)
  if (!pipeline || pipeline.status !== 'in_progress') {
    return { cancelled: [], pipelineCancelled: false }
  }

  const lastUpdate = pipeline.updatedAt || pipeline.startedAt
  const age = Date.now() - new Date(lastUpdate).getTime()
  if (age < staleMs) {
    return { cancelled: [], pipelineCancelled: false }
  }

  const now = new Date().toISOString()
  const cancelled = []

  // 파이프라인 소속 에이전트 중 in_progress/pending → cancelled
  for (const step of pipeline.steps ?? []) {
    if (step.status === 'in_progress' || step.status === 'pending') {
      const agentState = readState(step.agent, STATE_DIR)
      if (agentState && (agentState.status === 'in_progress' || agentState.status === 'idle')) {
        writeState(step.agent, {
          ...agentState,
          status: 'cancelled',
          cancelledAt: now,
          reason: 'pipeline_stale'
        }, STATE_DIR)
        cancelled.push(step.agent)
      }
    }
  }

  // 파이프라인 자체도 cancelled
  writeState('pipeline', {
    ...pipeline,
    status: 'cancelled',
    cancelledAt: now,
    reason: `${Math.floor(age / 60000)}분간 업데이트 없음`,
    steps: (pipeline.steps ?? []).map(step =>
      step.status === 'in_progress' || step.status === 'pending'
        ? { ...step, status: 'cancelled', cancelledAt: now }
        : step
    )
  }, STATE_DIR)

  return { cancelled, pipelineCancelled: true }
}

/**
 * 파이프라인에서 실패한 에이전트의 하류 에이전트를 blocked 처리한다.
 * (cleanup에서 호출)
 *
 * @returns {{ blocked: string[] }}
 */
export function blockDownstreamOfFailed() {
  const pipeline = readState('pipeline', STATE_DIR)
  if (!pipeline || pipeline.status !== 'in_progress') {
    return { blocked: [] }
  }

  const steps = pipeline.steps ?? []
  const blocked = []
  let foundFailed = false

  for (const step of steps) {
    if (step.status === 'failed') {
      foundFailed = true
      continue
    }
    // 실패 에이전트 이후의 pending 단계 → blocked
    if (foundFailed && step.status === 'pending') {
      const agentState = readState(step.agent, STATE_DIR)
      if (!agentState || agentState.status === 'idle' || !agentState.status) {
        writeState(step.agent, {
          agent: step.agent,
          status: 'blocked',
          blockedAt: new Date().toISOString(),
          reason: 'upstream_failed'
        }, STATE_DIR)
      }
      blocked.push(step.agent)
    }
  }

  if (blocked.length > 0) {
    writeState('pipeline', {
      ...pipeline,
      steps: steps.map(step =>
        blocked.includes(step.agent)
          ? { ...step, status: 'blocked', blockedAt: new Date().toISOString() }
          : step
      )
    }, STATE_DIR)
  }

  return { blocked }
}
