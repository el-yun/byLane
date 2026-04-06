import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

// 현재 실행 중인 루프가 있는지 확인 (review-loop, respond-loop)
function isAnyLoopActive(stateDir = '.bylane/state') {
  if (!existsSync(stateDir)) return false
  try {
    return readdirSync(stateDir)
      .filter(f => f.endsWith('-loop.json'))
      .some(f => {
        try {
          const s = JSON.parse(readFileSync(join(stateDir, f), 'utf8'))
          return s.status === 'running'
        } catch { return false }
      })
  } catch { return false }
}

function getIssueMemoryPath(issueNumber, config) {
  const dir = config?.memory?.dir ?? '.bylane/memory'
  return join(dir, 'issues', `${issueNumber}.md`)
}

export function readIssueMemory(issueNumber, config = {}) {
  const path = getIssueMemoryPath(issueNumber, config)
  if (!existsSync(path)) return null
  try { return readFileSync(path, 'utf8') } catch { return null }
}

export function appendIssueMemory(issueNumber, agentName, content, config = {}) {
  if (config?.memory?.enabled === false) return

  const timestamp = new Date().toISOString()
  const entry = `\n## [${agentName}] ${timestamp}\n\n${content}\n`

  if (isAnyLoopActive()) {
    // 루프 실행 중 → GitHub 이슈 코멘트에 기록
    postGitHubComment(issueNumber, entry, config)
  } else {
    // 루프 없음 → 로컬 파일에 기록
    const path = getIssueMemoryPath(issueNumber, config)
    const memDir = join(config?.memory?.dir ?? '.bylane/memory', 'issues')
    mkdirSync(memDir, { recursive: true })

    const existing = existsSync(path) ? readFileSync(path, 'utf8') : `# Issue #${issueNumber} Memory\n`
    writeFileSync(path, existing + entry)
  }
}

function postGitHubComment(issueNumber, content, config) {
  try {
    const method = config?.github?.method ?? 'auto'
    const owner = config?.github?.owner ?? ''
    const repo = config?.github?.repo ?? ''

    if ((method === 'auto' || method === 'cli') && isCommandAvailable('gh')) {
      const repoFlag = owner && repo ? `--repo ${owner}/${repo}` : ''
      execSync(`gh issue comment ${issueNumber} ${repoFlag} --body ${JSON.stringify(content)}`, { stdio: 'ignore' })
      return
    }

    if ((method === 'auto' || method === 'api') && process.env.GITHUB_TOKEN) {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`
      execSync(
        `curl -s -X POST -H "Authorization: Bearer ${process.env.GITHUB_TOKEN}" -H "Content-Type: application/json" ${url} -d ${JSON.stringify(JSON.stringify({ body: content }))}`,
        { stdio: 'ignore' }
      )
    }
  } catch {
    // GitHub 코멘트 실패 시 로컬 파일에 fallback
    const path = getIssueMemoryPath(issueNumber, config)
    const memDir = join(config?.memory?.dir ?? '.bylane/memory', 'issues')
    mkdirSync(memDir, { recursive: true })
    const existing = existsSync(path) ? readFileSync(path, 'utf8') : `# Issue #${issueNumber} Memory\n`
    writeFileSync(path, existing + content)
  }
}

function isCommandAvailable(cmd) {
  try { execSync(`which ${cmd}`, { stdio: 'ignore' }); return true } catch { return false }
}

export function listIssueMemories(config = {}) {
  const dir = join(config?.memory?.dir ?? '.bylane/memory', 'issues')
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''))
      .sort((a, b) => Number(a) - Number(b))
  } catch { return [] }
}
