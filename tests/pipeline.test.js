import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { writeState, readState } from '../src/state.js'
import {
  startPipeline, updatePipelineStep, completePipeline,
  getActivePipeline, cancelStalePipeline, blockDownstreamOfFailed,
  PIPELINES
} from '../src/pipeline.js'

const STATE_DIR = '.bylane/state'

beforeEach(() => mkdirSync(STATE_DIR, { recursive: true }))
afterEach(() => rmSync('.bylane', { recursive: true, force: true }))

describe('startPipeline', () => {
  it('파이프라인 상태를 기록한다', () => {
    startPipeline({ type: 'A', issueNumber: 42, steps: PIPELINES.A })
    const state = readState('pipeline', STATE_DIR)

    expect(state.status).toBe('in_progress')
    expect(state.pipelineType).toBe('A')
    expect(state.issueNumber).toBe(42)
    expect(state.currentStep).toBe('issue-agent')
    expect(state.steps).toHaveLength(7)
    expect(state.steps[0]).toMatchObject({ agent: 'issue-agent', status: 'pending' })
  })
})

describe('updatePipelineStep', () => {
  it('에이전트 상태를 업데이트하고 다음 단계로 이동한다', () => {
    startPipeline({ type: 'B', steps: ['code-agent', 'test-agent', 'commit-agent'] })

    updatePipelineStep('code-agent', 'in_progress')
    let state = readState('pipeline', STATE_DIR)
    expect(state.steps[0].status).toBe('in_progress')

    updatePipelineStep('code-agent', 'completed')
    state = readState('pipeline', STATE_DIR)
    expect(state.steps[0].status).toBe('completed')
    expect(state.currentStep).toBe('test-agent')
    expect(state.status).toBe('in_progress')
  })

  it('마지막 에이전트 완료 시 파이프라인도 completed', () => {
    startPipeline({ type: 'D', steps: ['review-agent'] })
    updatePipelineStep('review-agent', 'completed')
    const state = readState('pipeline', STATE_DIR)
    expect(state.status).toBe('completed')
  })

  it('에이전트 실패 시 파이프라인 상태가 failed', () => {
    startPipeline({ type: 'B', steps: ['code-agent', 'test-agent'] })
    updatePipelineStep('code-agent', 'failed')
    const state = readState('pipeline', STATE_DIR)
    expect(state.status).toBe('failed')
  })

  it('파이프라인이 없으면 무시한다', () => {
    // 에러 없이 실행되어야 함
    updatePipelineStep('code-agent', 'completed')
  })
})

describe('completePipeline', () => {
  it('파이프라인을 완료 처리한다', () => {
    startPipeline({ type: 'A', steps: ['issue-agent'] })
    completePipeline()
    const state = readState('pipeline', STATE_DIR)
    expect(state.status).toBe('completed')
    expect(state.completedAt).toBeTruthy()
  })
})

describe('getActivePipeline', () => {
  it('in_progress 파이프라인을 반환한다', () => {
    startPipeline({ type: 'A', steps: ['issue-agent'] })
    expect(getActivePipeline()).toBeTruthy()
  })

  it('completed 파이프라인은 null', () => {
    startPipeline({ type: 'A', steps: ['issue-agent'] })
    completePipeline()
    expect(getActivePipeline()).toBeNull()
  })

  it('파이프라인 없으면 null', () => {
    expect(getActivePipeline()).toBeNull()
  })
})

describe('cancelStalePipeline', () => {
  it('stale 파이프라인의 에이전트를 cascade cancel한다', () => {
    // 30분 전에 시작된 파이프라인 시뮬레이션 — writeState는 updatedAt을 현재로 덮어쓰므로 직접 작성
    const oldTime = new Date(Date.now() - 31 * 60 * 1000).toISOString()
    writeFileSync(join(STATE_DIR, 'pipeline.json'), JSON.stringify({
      agent: 'pipeline',
      status: 'in_progress',
      pipelineType: 'B',
      startedAt: oldTime,
      updatedAt: oldTime,
      currentStep: 'code-agent',
      steps: [
        { agent: 'code-agent', status: 'in_progress' },
        { agent: 'test-agent', status: 'pending' }
      ],
      log: []
    }, null, 2))
    // 에이전트 상태도 생성
    writeState('code-agent', { status: 'in_progress', startedAt: oldTime }, STATE_DIR)

    const result = cancelStalePipeline()

    expect(result.pipelineCancelled).toBe(true)
    expect(result.cancelled).toContain('code-agent')

    const codeState = readState('code-agent', STATE_DIR)
    expect(codeState.status).toBe('cancelled')
    expect(codeState.reason).toBe('pipeline_stale')

    const pipelineState = readState('pipeline', STATE_DIR)
    expect(pipelineState.status).toBe('cancelled')
  })

  it('fresh 파이프라인은 건드리지 않는다', () => {
    startPipeline({ type: 'A', steps: ['issue-agent'] })
    const result = cancelStalePipeline()
    expect(result.pipelineCancelled).toBe(false)
    expect(readState('pipeline', STATE_DIR).status).toBe('in_progress')
  })

  it('파이프라인이 없으면 아무것도 안 한다', () => {
    const result = cancelStalePipeline()
    expect(result.cancelled).toEqual([])
  })
})

describe('blockDownstreamOfFailed', () => {
  it('실패 에이전트 하류를 blocked 처리한다', () => {
    writeState('pipeline', {
      status: 'in_progress',
      steps: [
        { agent: 'code-agent', status: 'completed' },
        { agent: 'test-agent', status: 'failed' },
        { agent: 'commit-agent', status: 'pending' },
        { agent: 'pr-agent', status: 'pending' }
      ]
    }, STATE_DIR)

    const result = blockDownstreamOfFailed()

    expect(result.blocked).toEqual(['commit-agent', 'pr-agent'])

    const commitState = readState('commit-agent', STATE_DIR)
    expect(commitState.status).toBe('blocked')
    expect(commitState.reason).toBe('upstream_failed')
  })

  it('실패 없으면 아무것도 안 한다', () => {
    writeState('pipeline', {
      status: 'in_progress',
      steps: [
        { agent: 'code-agent', status: 'completed' },
        { agent: 'test-agent', status: 'in_progress' }
      ]
    }, STATE_DIR)

    const result = blockDownstreamOfFailed()
    expect(result.blocked).toEqual([])
  })
})
