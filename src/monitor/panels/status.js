import blessed from 'blessed'
import { loadConfig } from '../../config.js'

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
    update() {
      const config = loadConfig()
      const check = (v) => v ? '{green-fg}✓{/green-fg}' : '{red-fg}✗{/red-fg}'
      const lines = [
        ` GitHub      ${check(true)} 연결됨`,
        ` Linear      ${check(config.trackers.linear.enabled)} ${config.trackers.linear.enabled ? '활성' : '비활성'}`,
        ` Figma MCP   ${check(config.extensions.figma.enabled)} ${config.extensions.figma.enabled ? '활성' : '비활성'}`,
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
