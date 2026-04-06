import { describe, it, expect } from 'vitest'
import { reconcileQueue, expireStaleItems, gcQueue, maintainQueue, QUEUE_TTL_MS, GC_AGE_MS } from '../src/queue-utils.js'

describe('reconcileQueue', () => {
  it('활성 PR 목록에 없는 pending 항목을 resolved로 전환한다', () => {
    const queue = [
      { number: 1, status: 'pending', detectedAt: new Date().toISOString() },
      { number: 2, status: 'pending', detectedAt: new Date().toISOString() },
      { number: 3, status: 'responded', detectedAt: new Date().toISOString() }
    ]
    const activePrs = new Set([2])
    const { queue: result, resolvedCount } = reconcileQueue(queue, activePrs)

    expect(resolvedCount).toBe(1)
    expect(result[0].status).toBe('resolved')
    expect(result[0].reason).toBe('no_longer_actionable')
    expect(result[0].resolvedAt).toBeTruthy()
    expect(result[1].status).toBe('pending')
    // responded 항목은 건드리지 않음
    expect(result[2].status).toBe('responded')
  })

  it('모든 항목이 활성이면 변경 없음', () => {
    const queue = [
      { number: 1, status: 'pending' },
      { number: 2, status: 'pending' }
    ]
    const { queue: result, resolvedCount } = reconcileQueue(queue, new Set([1, 2]))
    expect(resolvedCount).toBe(0)
    expect(result[0].status).toBe('pending')
    expect(result[1].status).toBe('pending')
  })

  it('빈 큐에서 동작한다', () => {
    const { queue, resolvedCount } = reconcileQueue([], new Set([1]))
    expect(queue).toEqual([])
    expect(resolvedCount).toBe(0)
  })
})

describe('expireStaleItems', () => {
  it('TTL 초과 pending 항목을 expired로 전환한다', () => {
    const old = new Date(Date.now() - QUEUE_TTL_MS - 1000).toISOString()
    const fresh = new Date().toISOString()
    const queue = [
      { number: 1, status: 'pending', detectedAt: old },
      { number: 2, status: 'pending', detectedAt: fresh },
      { number: 3, status: 'resolved', detectedAt: old }
    ]
    const { queue: result, expiredCount } = expireStaleItems(queue)

    expect(expiredCount).toBe(1)
    expect(result[0].status).toBe('expired')
    expect(result[0].expiredAt).toBeTruthy()
    expect(result[1].status).toBe('pending')
    // resolved는 건드리지 않음
    expect(result[2].status).toBe('resolved')
  })

  it('커스텀 TTL을 적용할 수 있다', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const queue = [{ number: 1, status: 'pending', detectedAt: twoHoursAgo }]
    const { expiredCount } = expireStaleItems(queue, 1 * 60 * 60 * 1000)
    expect(expiredCount).toBe(1)
  })

  it('detectedAt 없는 항목은 건너뛴다', () => {
    const queue = [{ number: 1, status: 'pending' }]
    const { expiredCount } = expireStaleItems(queue)
    expect(expiredCount).toBe(0)
  })
})

describe('gcQueue', () => {
  it('GC 기준 초과한 resolved/expired 항목을 제거한다', () => {
    const oldTs = new Date(Date.now() - GC_AGE_MS - 1000).toISOString()
    const freshTs = new Date().toISOString()
    const queue = [
      { number: 1, status: 'resolved', resolvedAt: oldTs },
      { number: 2, status: 'expired', expiredAt: oldTs },
      { number: 3, status: 'resolved', resolvedAt: freshTs },
      { number: 4, status: 'pending', detectedAt: oldTs }
    ]
    const { queue: result, removedCount } = gcQueue(queue)

    expect(removedCount).toBe(2)
    expect(result).toHaveLength(2)
    expect(result[0].number).toBe(3)
    expect(result[1].number).toBe(4)
  })

  it('GC 기준 미달이면 유지한다', () => {
    const freshTs = new Date().toISOString()
    const queue = [
      { number: 1, status: 'resolved', resolvedAt: freshTs },
      { number: 2, status: 'expired', expiredAt: freshTs }
    ]
    const { removedCount } = gcQueue(queue)
    expect(removedCount).toBe(0)
  })
})

describe('maintainQueue', () => {
  it('reconcile + expire + GC를 한 번에 실행한다', () => {
    const oldTs = new Date(Date.now() - GC_AGE_MS - 1000).toISOString()
    const staleTs = new Date(Date.now() - QUEUE_TTL_MS - 1000).toISOString()
    const freshTs = new Date().toISOString()

    const queue = [
      { number: 1, status: 'pending', detectedAt: freshTs },        // active → stays
      { number: 2, status: 'pending', detectedAt: freshTs },        // not active → resolved
      { number: 3, status: 'pending', detectedAt: staleTs },        // TTL 초과 → expired
      { number: 4, status: 'resolved', resolvedAt: oldTs },         // GC 대상
      { number: 5, status: 'responded', detectedAt: freshTs }       // 유지
    ]
    const activePrs = new Set([1])

    const result = maintainQueue(queue, activePrs)

    // #2, #3 모두 active에 없으므로 reconcile에서 resolved (expire보다 먼저 실행)
    expect(result.resolvedCount).toBe(2)  // #2, #3
    expect(result.expiredCount).toBe(0)   // reconcile이 먼저 resolved 처리
    expect(result.removedCount).toBe(1)   // #4

    // 남은 항목 확인
    expect(result.queue).toHaveLength(4)
    expect(result.queue.find(q => q.number === 1).status).toBe('pending')
    expect(result.queue.find(q => q.number === 2).status).toBe('resolved')
    expect(result.queue.find(q => q.number === 3).status).toBe('resolved')
    expect(result.queue.find(q => q.number === 5).status).toBe('responded')
  })

  it('activePrNumbers가 null이면 reconcile을 생략한다', () => {
    const queue = [
      { number: 1, status: 'pending', detectedAt: new Date().toISOString() }
    ]
    const result = maintainQueue(queue, null)
    expect(result.resolvedCount).toBe(0)
    expect(result.queue[0].status).toBe('pending')
  })
})
