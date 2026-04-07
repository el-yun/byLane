import blessed from 'blessed'
import { execSync } from 'child_process'
import { loadConfig } from '../../config.js'

function isTmuxAlive(sessionName) {
  try {
    execSync(`tmux has-session -t ${sessionName}`, { stdio: ['pipe', 'pipe', 'pipe'] })
    return true
  } catch { return false }
}

export function createStatusPanel(screen) {
  const box = blessed.box({
    top: '60%',
    left: '50%',
    width: '50%',
    height: '40%',
    label: ' SYSTEM STATUS ',
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } }
  })
  screen.append(box)

  return {
    update(states = {}) {
      const config = loadConfig()
      const check = (v) => v ? '{green-fg}OK{/green-fg}' : '{red-fg}--{/red-fg}'

      // 루프 상태
      const reviewState = states['review-loop']
      const respondState = states['respond-loop']
      const loopMode = config.loop?.mode ?? 'tmux'
      const sessionName = config.loop?.sessionName ?? 'bylane-loops'
      const tmuxAlive = loopMode === 'tmux' ? isTmuxAlive(sessionName) : null

      const loopStatus = (state) => {
        if (!state) return '{red-fg}미실행{/red-fg}'
        if (state.status === 'running') return `{green-fg}실행중{/green-fg} PID:${state.pid ?? '?'}`
        if (state.status === 'stopped') return '{yellow-fg}중지됨{/yellow-fg}'
        return `{grey-fg}${state.status ?? '알 수 없음'}{/grey-fg}`
      }

      const lines = [
        ` ── 루프 ──`,
        ` review-loop  ${loopStatus(reviewState)}`,
        ` respond-loop ${loopStatus(respondState)}`,
        tmuxAlive !== null
          ? ` tmux [${sessionName}]  ${tmuxAlive ? '{green-fg}세션 유지{/green-fg}' : '{red-fg}세션 없음{/red-fg}'}`
          : ` 모드: process`,
        ``,
        ` ── 연동 ──`,
        ` GitHub      ${check(true)} 연결됨`,
        ` Linear      ${check(config.trackers.linear.enabled)} ${config.trackers.linear.enabled ? '활성' : '비활성'}`,
        ` Slack       ${check(config.notifications.slack.enabled)} ${config.notifications.slack.channel || '미설정'}`,
        ` Telegram    ${check(config.notifications.telegram.enabled)} ${config.notifications.telegram.chatId || '미설정'}`,
        ``,
        ` 팀 모드     ${check(config.team.enabled)} ${config.team.enabled ? `활성 (${config.team.members.length}명)` : '비활성'}`,
        ` 권한 범위   ${config.permissions.scope}`
      ]
      box.setContent(lines.join('\n'))
      screen.render()
    }
  }
}
