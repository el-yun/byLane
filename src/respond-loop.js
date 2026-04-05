#!/usr/bin/env node
/**
 * respond-loop.js
 * 5분 주기로 내 PR에 달린 리뷰/코멘트를 감지해 .bylane/state/respond-queue.json에 기록한다.
 * REQUEST_CHANGES 및 새 코멘트 포함.
 */
import { execSync } from 'child_process'
import { mkdirSync } from 'fs'
import { writeState, readState, appendLog } from './state.js'
import { loadConfig } from './config.js'

const INTERVAL_MS = 5 * 60 * 1000
const STATE_DIR = '.bylane/state'

mkdirSync(STATE_DIR, { recursive: true })

function fetchMyPRsWithReviews(method, owner, repo) {
  // CLI
  if (method === 'cli' || method === 'auto') {
    try {
      const out = execSync(
        'gh pr list --author @me --json number,title,url,headRefName,updatedAt,reviewDecision,reviews --limit 50',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      )
      const prs = JSON.parse(out)
      return prs.filter(pr =>
        pr.reviewDecision === 'CHANGES_REQUESTED' ||
        (pr.reviews ?? []).some(r => r.state === 'CHANGES_REQUESTED' || r.state === 'COMMENTED')
      )
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
      .filter(pr => pr.requested_reviewers?.length > 0 || pr.review_comments > 0)
      .map(pr => ({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        headRefName: pr.head.ref,
        updatedAt: pr.updated_at,
        reviewDecision: null
      }))
  }

  return []
}

function fetchReviewComments(method, owner, repo, prNumber) {
  if (method === 'cli' || method === 'auto') {
    try {
      const out = execSync(
        `gh pr view ${prNumber} --json reviews,comments`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      )
      return JSON.parse(out)
    } catch {
      if (method === 'cli') throw new Error('gh CLI 실패')
    }
  }

  if (method === 'api' || method === 'auto') {
    const token = process.env.GITHUB_TOKEN
    const reviewsOut = execSync(
      `curl -s -H "Authorization: Bearer ${token}" ` +
      `"https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews"`,
      { encoding: 'utf8' }
    )
    return { reviews: JSON.parse(reviewsOut), comments: [] }
  }

  return { reviews: [], comments: [] }
}

function loadQueue() {
  try {
    const s = readState('respond-queue', STATE_DIR)
    return s?.queue ?? []
  } catch {
    return []
  }
}

function saveQueue(queue) {
  writeState('respond-queue', { status: 'running', queue }, STATE_DIR)
}

async function poll() {
  const config = loadConfig()
  const method = config.github?.method ?? 'auto'
  const owner = config.github?.owner ?? ''
  const repo = config.github?.repo ?? ''

  appendLog('respond-loop', `폴링 시작 (method: ${method})`, STATE_DIR)

  let prs
  try {
    prs = fetchMyPRsWithReviews(method, owner, repo)
  } catch (err) {
    appendLog('respond-loop', `오류: ${err.message}`, STATE_DIR)
    return
  }

  const queue = loadQueue()
  const queueMap = Object.fromEntries(queue.map(q => [q.number, q]))

  let newCount = 0
  for (const pr of prs) {
    let detail
    try {
      detail = fetchReviewComments(method, owner, repo, pr.number)
    } catch {
      detail = { reviews: [], comments: [] }
    }

    const hasChangesRequested = (detail.reviews ?? []).some(r => r.state === 'CHANGES_REQUESTED')
    const hasComments = (detail.reviews ?? []).some(r => r.state === 'COMMENTED') ||
                        (detail.comments ?? []).length > 0
    const needsResponse = hasChangesRequested || hasComments

    if (!needsResponse) continue

    const existing = queueMap[pr.number]
    const isNew = !existing
    const isUpdated = existing &&
      existing.updatedAt !== pr.updatedAt &&
      existing.status === 'responded'

    if (isNew || isUpdated) {
      queueMap[pr.number] = {
        number: pr.number,
        title: pr.title,
        url: pr.url,
        branch: pr.headRefName,
        updatedAt: pr.updatedAt,
        hasChangesRequested,
        status: 'pending',
        detectedAt: new Date().toISOString()
      }
      newCount++
      appendLog('respond-loop',
        `${isNew ? '새' : '재요청'} PR #${pr.number}: ${pr.title} ${hasChangesRequested ? '[CHANGES_REQUESTED]' : '[COMMENTED]'}`,
        STATE_DIR
      )
    }
  }

  saveQueue(Object.values(queueMap))

  if (newCount > 0) {
    appendLog('respond-loop', `${newCount}개 PR이 큐에 추가됨`, STATE_DIR)
  } else {
    appendLog('respond-loop', '새 리뷰 코멘트 없음', STATE_DIR)
  }
}

// 초기 실행
poll()

// 5분 주기 폴링
const timer = setInterval(poll, INTERVAL_MS)

// 종료 처리
process.on('SIGINT', () => {
  clearInterval(timer)
  writeState('respond-loop', { status: 'stopped' }, STATE_DIR)
  process.exit(0)
})
process.on('SIGTERM', () => {
  clearInterval(timer)
  writeState('respond-loop', { status: 'stopped' }, STATE_DIR)
  process.exit(0)
})

writeState('respond-loop', { status: 'running', startedAt: new Date().toISOString() }, STATE_DIR)
console.log('respond-loop 시작. Ctrl+C로 종료.')
