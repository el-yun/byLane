/**
 * preflight.js
 * GitHub CLI/MCP/API, 알림 채널 연동 상태를 점검하고 문제가 있으면 가이드를 출력한다.
 * `npx @elyun/bylane preflight` 또는 에이전트 시작 전 자동 실행.
 */
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { loadConfig } from './config.js'

const CONFIG_PATH = '.bylane/bylane.json'

function run(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim() }
  } catch (e) {
    return { ok: false, out: e.stderr?.toString().trim() ?? '' }
  }
}

function checkGhCli() {
  const which = run('which gh')
  if (!which.ok) return { ok: false, reason: 'gh CLI 미설치', fix: 'brew install gh  # 또는 https://cli.github.com' }

  const auth = run('gh auth status')
  if (!auth.ok) return { ok: false, reason: 'gh CLI 로그인 필요', fix: 'gh auth login' }

  return { ok: true, detail: auth.out.split('\n')[0] }
}

function checkGithubToken() {
  const token = process.env.GITHUB_TOKEN
  if (!token) return { ok: false, reason: 'GITHUB_TOKEN 환경변수 없음', fix: 'export GITHUB_TOKEN=ghp_xxxx' }
  if (token.length < 10) return { ok: false, reason: 'GITHUB_TOKEN 값이 너무 짧음', fix: '올바른 토큰을 설정하세요' }
  return { ok: true, detail: `설정됨 (${token.slice(0,4)}…)` }
}

function checkSlack(config) {
  if (!config.notifications?.slack?.enabled) return null
  const channel = config.notifications.slack.channel
  if (!channel) return { ok: false, reason: 'slack.channel 미설정', fix: '.bylane/bylane.json의 notifications.slack.channel 설정' }
  return { ok: true, detail: `채널: ${channel}` }
}

function checkTelegram(config) {
  if (!config.notifications?.telegram?.enabled) return null
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID || config.notifications.telegram.chatId
  if (!botToken) return { ok: false, reason: 'TELEGRAM_BOT_TOKEN 환경변수 없음', fix: 'export TELEGRAM_BOT_TOKEN=xxx' }
  if (!chatId) return { ok: false, reason: 'TELEGRAM_CHAT_ID 미설정', fix: 'export TELEGRAM_CHAT_ID=xxx 또는 bylane.json에 설정' }
  return { ok: true, detail: `chat_id: ${chatId}` }
}

/**
 * 전체 점검 실행
 * @returns {{ passed: boolean, results: Array<{name, ok, detail?, reason?, fix?}> }}
 */
export function runPreflight() {
  const results = []

  // 1. bylane.json 존재 여부
  if (!existsSync(CONFIG_PATH)) {
    results.push({
      name: 'bylane 설정',
      ok: false,
      reason: '.bylane/bylane.json 없음',
      fix: '/bylane setup  을 실행하여 초기 설정을 완료하세요.'
    })
    return { passed: false, results }
  }

  let config
  try { config = loadConfig() } catch (e) {
    results.push({ name: 'bylane 설정', ok: false, reason: `bylane.json 파싱 오류: ${e.message}`, fix: '/bylane setup 으로 재생성' })
    return { passed: false, results }
  }
  results.push({ name: 'bylane 설정', ok: true, detail: `v${config.version ?? '?'}` })

  // 2. GitHub 접근
  const method = config.github?.method ?? 'auto'

  if (method === 'cli') {
    const r = checkGhCli()
    results.push({ name: 'GitHub CLI', ...r })
  } else if (method === 'api') {
    const r = checkGithubToken()
    results.push({ name: 'GitHub Token', ...r })
  } else if (method === 'auto' || method === 'mcp') {
    // auto/mcp: CLI도 확인해두면 유용
    const cli = checkGhCli()
    const token = checkGithubToken()
    const anyOk = cli.ok || token.ok

    if (method === 'mcp') {
      results.push({
        name: 'GitHub MCP',
        ok: true,
        detail: 'Claude Code 세션에서 자동 사용 (별도 확인 불필요)'
      })
    }
    results.push({ name: 'GitHub CLI (fallback)', ...cli })
    results.push({ name: 'GitHub Token (fallback)', ...token })

    if (!anyOk && method === 'auto') {
      results.find(r => r.name === 'GitHub CLI (fallback)').critical = true
    }
  }

  // 3. 알림 채널 (설정된 경우만)
  const slack = checkSlack(config)
  if (slack) results.push({ name: 'Slack 알림', ...slack })

  const telegram = checkTelegram(config)
  if (telegram) results.push({ name: 'Telegram 알림', ...telegram })

  const passed = results.every(r => r.ok)
  return { passed, results }
}

/** 결과를 읽기 좋은 텍스트로 포맷 */
export function formatPreflight({ passed, results }) {
  const lines = []
  lines.push('')
  lines.push('  ── byLane 사전 점검 ──')
  lines.push('')

  for (const r of results) {
    const icon = r.ok ? '  ✓' : (r.critical ? '  ✗' : '  !')
    const name = r.name.padEnd(22)
    const desc = r.ok ? (r.detail ?? 'OK') : r.reason
    lines.push(`${icon}  ${name} ${desc}`)
    if (!r.ok && r.fix) {
      lines.push(`       → ${r.fix}`)
    }
  }

  lines.push('')
  if (passed) {
    lines.push('  모든 항목 정상. 워크플로우를 시작합니다.')
  } else {
    lines.push('  일부 항목에 문제가 있습니다. 위 안내를 참고하여 설정을 완료하세요.')
    lines.push('  설정 완료 후 명령을 다시 실행하거나 /bylane setup 을 실행하세요.')
  }
  lines.push('')

  return lines.join('\n')
}
