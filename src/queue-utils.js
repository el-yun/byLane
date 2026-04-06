/**
 * queue-utils.js
 * 큐 상태 관리 공용 유틸 — reconcile, expire, GC
 */

/** 큐 항목 TTL: 24시간 이상 pending이면 expired */
export const QUEUE_TTL_MS = 24 * 60 * 60 * 1000

/** GC 대상: resolved/expired 후 1시간 경과 시 제거 */
export const GC_AGE_MS = 60 * 60 * 1000

/**
 * 현재 GitHub에서 가져온 PR 번호 목록과 큐를 대조하여
 * 더 이상 액션이 필요 없는 항목을 resolved로 전환한다.
 *
 * @param {Array} queue  기존 큐 배열
 * @param {Set<number>} activePrNumbers  현재 액션 필요한 PR 번호 Set
 * @returns {{ queue: Array, resolvedCount: number }}
 */
export function reconcileQueue(queue, activePrNumbers) {
  let resolvedCount = 0
  const now = new Date().toISOString()

  const result = queue.map(item => {
    // pending인데 현재 GitHub에서 더 이상 해당 PR이 액션 필요 목록에 없음
    if (item.status === 'pending' && !activePrNumbers.has(item.number)) {
      resolvedCount++
      return { ...item, status: 'resolved', resolvedAt: now, reason: 'no_longer_actionable' }
    }
    return item
  })

  return { queue: result, resolvedCount }
}

/**
 * TTL 초과된 pending 항목을 expired로 전환한다.
 *
 * @param {Array} queue  큐 배열
 * @param {number} [ttlMs=QUEUE_TTL_MS]  TTL (밀리초)
 * @returns {{ queue: Array, expiredCount: number }}
 */
export function expireStaleItems(queue, ttlMs = QUEUE_TTL_MS) {
  const now = Date.now()
  let expiredCount = 0

  const result = queue.map(item => {
    if (item.status === 'pending' && item.detectedAt) {
      const age = now - new Date(item.detectedAt).getTime()
      if (age > ttlMs) {
        expiredCount++
        return { ...item, status: 'expired', expiredAt: new Date().toISOString() }
      }
    }
    return item
  })

  return { queue: result, expiredCount }
}

/**
 * resolved/expired 항목 중 일정 시간이 지난 것을 큐에서 제거한다.
 *
 * @param {Array} queue  큐 배열
 * @param {number} [gcAgeMs=GC_AGE_MS]  GC 기준 시간 (밀리초)
 * @returns {{ queue: Array, removedCount: number }}
 */
export function gcQueue(queue, gcAgeMs = GC_AGE_MS) {
  const now = Date.now()
  const before = queue.length

  const result = queue.filter(item => {
    if (item.status === 'resolved' || item.status === 'expired') {
      const ts = item.resolvedAt || item.expiredAt
      if (ts && now - new Date(ts).getTime() > gcAgeMs) {
        return false
      }
    }
    return true
  })

  return { queue: result, removedCount: before - result.length }
}

/**
 * reconcile + expire + GC 를 한 번에 실행한다.
 *
 * @param {Array} queue  기존 큐 배열
 * @param {Set<number>|null} activePrNumbers  현재 액션 필요한 PR 번호 Set (null이면 reconcile 생략)
 * @param {{ ttlMs?: number, gcAgeMs?: number }} [opts]
 * @returns {{ queue: Array, resolvedCount: number, expiredCount: number, removedCount: number }}
 */
export function maintainQueue(queue, activePrNumbers, opts = {}) {
  const { ttlMs = QUEUE_TTL_MS, gcAgeMs = GC_AGE_MS } = opts

  let resolvedCount = 0
  let expiredCount = 0
  let removedCount = 0
  let current = queue

  // 1. Reconcile (activePrNumbers가 있을 때만)
  if (activePrNumbers) {
    const r = reconcileQueue(current, activePrNumbers)
    current = r.queue
    resolvedCount = r.resolvedCount
  }

  // 2. Expire stale pending items
  const e = expireStaleItems(current, ttlMs)
  current = e.queue
  expiredCount = e.expiredCount

  // 3. GC resolved/expired items
  const g = gcQueue(current, gcAgeMs)
  current = g.queue
  removedCount = g.removedCount

  return { queue: current, resolvedCount, expiredCount, removedCount }
}
