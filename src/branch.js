export function buildBranchName(pattern, tokens, caseStyle = null) {
  let result = pattern
  for (const [key, value] of Object.entries(tokens)) {
    if (!value) {
      // 빈 토큰과 앞의 구분자(-) 제거
      result = result.replace(new RegExp(`[-_]\\{${key}\\}`), '')
      result = result.replace(new RegExp(`\\{${key}\\}[-_]?`), '')
    } else {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }
  }
  // 잔여 미치환 토큰 제거
  result = result.replace(/\{[^}]+\}/g, '')
  // 중복 구분자 정리 (슬래시는 보존)
  result = result.replace(/[-_]{2,}/g, '-').replace(/^[-_]|[-_]$/g, '')
  if (caseStyle === 'kebab-case') {
    result = result.replace(/\s+/g, '-').toLowerCase()
  }
  return result
}

export function buildBranchNameFromConfig(config, issueNumber, extra = {}) {
  const tokens = {
    ...config.branch.tokens,
    'issue-number': String(issueNumber),
    ...extra
  }
  return buildBranchName(config.branch.pattern, tokens, config.branch.caseStyle)
}
