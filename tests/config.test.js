import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadConfig, saveConfig, validateConfig, DEFAULT_CONFIG } from '../src/config.js'
import { mkdirSync, rmSync, writeFileSync } from 'fs'

const TEST_DIR = '.bylane-config-test'

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }))
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

describe('DEFAULT_CONFIG', () => {
  it('기본 maxRetries는 3이다', () => {
    expect(DEFAULT_CONFIG.workflow.maxRetries).toBe(3)
  })

  it('기본 primary tracker는 github이다', () => {
    expect(DEFAULT_CONFIG.trackers.primary).toBe('github')
  })
})

describe('loadConfig', () => {
  it('파일이 없으면 DEFAULT_CONFIG를 반환한다', () => {
    const config = loadConfig(TEST_DIR)
    expect(config.workflow.maxRetries).toBe(3)
  })

  it('존재하는 설정 파일을 로드한다', () => {
    writeFileSync(`${TEST_DIR}/bylane.json`, JSON.stringify({
      ...DEFAULT_CONFIG,
      workflow: { ...DEFAULT_CONFIG.workflow, maxRetries: 5 }
    }))
    const config = loadConfig(TEST_DIR)
    expect(config.workflow.maxRetries).toBe(5)
  })
})

describe('saveConfig', () => {
  it('설정을 bylane.json에 저장한다', () => {
    saveConfig({ ...DEFAULT_CONFIG }, TEST_DIR)
    const loaded = loadConfig(TEST_DIR)
    expect(loaded.version).toBe('1.0')
  })
})

describe('validateConfig', () => {
  it('유효한 설정은 에러가 없다', () => {
    const errors = validateConfig(DEFAULT_CONFIG)
    expect(errors).toHaveLength(0)
  })

  it('maxRetries가 숫자가 아니면 에러를 반환한다', () => {
    const bad = { ...DEFAULT_CONFIG, workflow: { ...DEFAULT_CONFIG.workflow, maxRetries: 'abc' } }
    const errors = validateConfig(bad)
    expect(errors.length).toBeGreaterThan(0)
  })
})
