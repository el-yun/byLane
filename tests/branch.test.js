import { describe, it, expect } from 'vitest'
import { buildBranchName } from '../src/branch.js'

describe('buildBranchName', () => {
  it('{tracker}-{issue-number} 패턴 기본 케이스', () => {
    const result = buildBranchName(
      '{tracker}-{issue-number}',
      { tracker: 'issues', 'issue-number': '32' }
    )
    expect(result).toBe('issues-32')
  })

  it('{custom-id}가 비어있으면 해당 토큰과 앞 구분자를 제외한다', () => {
    const result = buildBranchName(
      '{tracker}-{issue-number}-{custom-id}',
      { tracker: 'issues', 'issue-number': '32', 'custom-id': '' }
    )
    expect(result).toBe('issues-32')
  })

  it('{custom-id}가 있으면 포함한다', () => {
    const result = buildBranchName(
      '{tracker}-{issue-number}-{custom-id}',
      { tracker: 'issues', 'issue-number': '32', 'custom-id': 'C-12' }
    )
    expect(result).toBe('issues-32-C-12')
  })

  it('{type}/{issue-number}-{title-slug} 패턴', () => {
    const result = buildBranchName(
      '{type}/{issue-number}-{title-slug}',
      { type: 'feature', 'issue-number': '32', 'title-slug': 'add-dark-mode' }
    )
    expect(result).toBe('feature/32-add-dark-mode')
  })

  it('kebab-case 변환: 공백을 하이픈으로', () => {
    const result = buildBranchName(
      '{type}-{title-slug}',
      { type: 'feat', 'title-slug': 'Add Dark Mode' },
      'kebab-case'
    )
    expect(result).toBe('feat-add-dark-mode')
  })

  it('슬래시 패턴에서 type이 비어있으면 선행 슬래시 없이 반환한다', () => {
    const result = buildBranchName(
      '{type}/{issue-number}',
      { type: '', 'issue-number': '32' },
      'kebab-case'
    )
    expect(result).toBe('32')
    expect(result.startsWith('/')).toBe(false)
  })
})
