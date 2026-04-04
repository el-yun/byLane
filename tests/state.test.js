import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readState, writeState, clearState, listStates, appendLog } from '../src/state.js'
import { mkdirSync, rmSync } from 'fs'

const TEST_DIR = '.bylane-test/state'

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }))
afterEach(() => rmSync('.bylane-test', { recursive: true, force: true }))

describe('writeState', () => {
  it('에이전트 상태를 JSON 파일에 저장한다', () => {
    writeState('code-agent', { status: 'in_progress', progress: 50 }, TEST_DIR)
    const result = readState('code-agent', TEST_DIR)
    expect(result.status).toBe('in_progress')
    expect(result.progress).toBe(50)
  })
})

describe('readState', () => {
  it('존재하지 않는 에이전트는 null을 반환한다', () => {
    const result = readState('nonexistent', TEST_DIR)
    expect(result).toBeNull()
  })

  it('저장된 상태에 agent 이름과 updatedAt이 포함된다', () => {
    writeState('issue-agent', { status: 'completed' }, TEST_DIR)
    const result = readState('issue-agent', TEST_DIR)
    expect(result.agent).toBe('issue-agent')
    expect(result.updatedAt).toBeDefined()
  })
})

describe('clearState', () => {
  it('특정 에이전트 상태 파일을 삭제한다', () => {
    writeState('pr-agent', { status: 'idle' }, TEST_DIR)
    clearState('pr-agent', TEST_DIR)
    expect(readState('pr-agent', TEST_DIR)).toBeNull()
  })
})

describe('listStates', () => {
  it('모든 에이전트 상태 목록을 반환한다', () => {
    writeState('code-agent', { status: 'completed' }, TEST_DIR)
    writeState('test-agent', { status: 'idle' }, TEST_DIR)
    const list = listStates(TEST_DIR)
    expect(list).toHaveLength(2)
    expect(list.map(s => s.agent)).toContain('code-agent')
  })
})

describe('appendLog', () => {
  it('로그 항목을 state에 추가한다', () => {
    writeState('code-agent', { status: 'in_progress', log: [] }, TEST_DIR)
    appendLog('code-agent', 'ThemeToggle.tsx 생성', TEST_DIR)
    const result = readState('code-agent', TEST_DIR)
    expect(result.log).toHaveLength(1)
    expect(result.log[0].msg).toBe('ThemeToggle.tsx 생성')
  })
})
