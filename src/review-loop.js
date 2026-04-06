#!/usr/bin/env node
/**
 * review-loop.js
 * 5분 주기로 GitHub review 요청된 PR을 감지해 .bylane/state/review-queue.json에 기록한다.
 */
import { execSync } from 'child_process'
import { mkdirSync } from 'fs'
import { writeState, readState, appendLog } from './state.js'
import { loadConfig } from './config.js'
import { killExistingLoop, createAbsoluteTimer } from './loop-utils.js'

const config = loadConfig()
const INTERVAL_MS = config.loop?.intervalMs ?? 300000
const STATE_DIR = '.bylane/state'

mkdirSync(STATE_DIR, { recursive: true })
killExistingLoop('review-loop', STATE_DIR)

function fetchPendingReviews(method, owner, repo) {
  // CLI
  if (method === 'cli' || method === 'auto') {
    try {
      const out = execSync(
        'gh pr list --review-requested @me --json number,title,url,headRefName,updatedAt --limit 50',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      )
      return JSON.parse(out)
    } catch {
      if (method === 'cli') throw new Error('gh CLI 실패')
    }
  }

  // API
  if (method === 'api' || method === 'auto') {
    const token = process.env.GITHUB_TOKEN
    if (!token) throw new Error('GITHUB_TOKEN 환경변수가 설정되지 않았습니다.')
    if (!owner || !repo) throw new Error('github.owner, github.repo 설정이 필요합니다.')

    const out = execSync(
      `curl -s -H "Authorization: Bearer ${token}" ` +
      `"https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=50"`,
      { encoding: 'utf8' }
    )
    const prs = JSON.parse(out)
    return prs
      .filter(pr => pr.requested_reviewers?.length > 0)
      .map(pr => ({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        headRefName: pr.head.ref,
        updatedAt: pr.updated_at
      }))
  }

  return []
}

function loadQueue() {
  try {
    const s = readState('review-queue', STATE_DIR)
    return s?.queue ?? []
  } catch {
    return []
  }
}

function saveQueue(queue) {
  writeState('review-queue', { status: 'running', queue }, STATE_DIR)
}

async function poll() {
  const config = loadConfig()
  const method = config.github?.method ?? 'auto'
  const owner = config.github?.owner ?? ''
  const repo = config.github?.repo ?? ''

  appendLog('review-loop', `폴링 시작 (method: ${method})`, STATE_DIR)

  let prs
  try {
    prs = fetchPendingReviews(method, owner, repo)
  } catch (err) {
    appendLog('review-loop', `오류: ${err.message}`, STATE_DIR)
    return
  }

  const queue = loadQueue()
  const queueMap = Object.fromEntries(queue.map(q => [q.number, q]))

  let newCount = 0
  for (const pr of prs) {
    const existing = queueMap[pr.number]
    const isNew = !existing
    const isUpdated = existing && existing.updatedAt !== pr.updatedAt && existing.status === 'reviewed'

    if (isNew || isUpdated) {
      queueMap[pr.number] = {
        number: pr.number,
        title: pr.title,
        url: pr.url,
        branch: pr.headRefName,
        updatedAt: pr.updatedAt,
        status: 'pending',
        detectedAt: new Date().toISOString()
      }
      newCount++
      appendLog('review-loop', `${isNew ? '새' : '재요청'} PR #${pr.number}: ${pr.title}`, STATE_DIR)
    }
  }

  saveQueue(Object.values(queueMap))

  if (newCount > 0) {
    appendLog('review-loop', `${newCount}개 PR이 큐에 추가됨`, STATE_DIR)
  } else {
    appendLog('review-loop', '새 review 요청 없음', STATE_DIR)
  }
}

// 초기 실행
poll()

// 절대 시간 기반 폴링 (잠자기 모드 후 즉시 보정)
const { stop } = createAbsoluteTimer(poll, INTERVAL_MS)

// 종료 처리
function shutdown() {
  stop()
  writeState('review-loop', { status: 'stopped' }, STATE_DIR)
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

writeState('review-loop', { status: 'running', startedAt: new Date().toISOString(), pid: process.pid }, STATE_DIR)
console.log('review-loop 시작. Ctrl+C로 종료.')
