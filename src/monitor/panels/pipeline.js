import blessed from 'blessed'

const AGENTS = [
  'orchestrator', 'issue-agent', 'code-agent', 'test-agent',
  'commit-agent', 'pr-agent', 'review-agent', 'respond-agent', 'notify-agent'
]

// 루프는 상태 파일에서 동적으로 감지 (-loop 접미사)
const KNOWN_LOOPS = ['review-loop', 'respond-loop']

const STATUS_ICON = {
  idle:        '[ ]',
  in_progress: '[>]',
  running:     '[>]',
  completed:   '[v]',
  stopped:     '[-]',
  failed:      '[x]',
  escalated:   '[!]'
}

export function createPipelinePanel(screen) {
  const box = blessed.box({
    top: 3,
    left: 0,
    width: '50%',
    height: '60%-3',
    label: ' AGENT PIPELINE ',
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } }
  })
  screen.append(box)

  return {
    update(states, subagents = { active: [], recent: [] }) {
      const lines = AGENTS.map(name => {
        const s = states[name]
        if (!s) return ` ${STATUS_ICON.idle} ${name.padEnd(16)} 대기`
        const icon = STATUS_ICON[s.status] ?? STATUS_ICON.idle
        const elapsed = s.startedAt
          ? `${Math.floor((Date.now() - new Date(s.startedAt)) / 1000)}s`
          : ''
        const bar = s.progress > 0
          ? `${'#'.repeat(Math.floor(s.progress / 10))}${'-'.repeat(10 - Math.floor(s.progress / 10))} ${s.progress}%`
          : ''
        return ` ${icon} ${name.padEnd(16)} ${elapsed.padEnd(6)} ${bar}`
      })

      const retries = states['orchestrator']?.retries ?? 0
      const maxRetries = states['orchestrator']?.maxRetries ?? 3
      lines.push('', ` Retries: ${retries}/${maxRetries}`)

      // 루프 프로세스 섹션 — 상태 파일에서 *-loop 동적 감지 + KNOWN_LOOPS 항상 표시
      const activeLoopNames = Object.keys(states).filter(n => n.endsWith('-loop'))
      const allLoops = [...new Set([...KNOWN_LOOPS, ...activeLoopNames])]
      lines.push('', ' LOOPS')
      for (const name of allLoops) {
        const s = states[name]
        if (!s) {
          lines.push(` [-] ${name.padEnd(16)} 미실행`)
        } else {
          const icon = STATUS_ICON[s.status] ?? '[-]'
          const elapsed = s.startedAt
            ? `${Math.floor((Date.now() - new Date(s.startedAt)) / 1000)}s`
            : ''
          lines.push(` ${icon} ${name.padEnd(16)} ${elapsed}`)
        }
      }

      // 하위 에이전트 섹션
      lines.push('', ' SUBAGENTS')
      if (subagents.active.length === 0) {
        lines.push(' 실행 중 없음')
      } else {
        for (const a of subagents.active) {
          const elapsed = `${Math.floor((Date.now() - new Date(a.startedAt)) / 1000)}s`
          const type = (a.subagentType ?? 'general').padEnd(14)
          const prompt = a.prompt.length > 28
            ? a.prompt.slice(0, 28) + '...'
            : a.prompt.padEnd(31)
          lines.push(` [>] ${type} ${elapsed.padEnd(6)} ${prompt}`)
        }
      }
      if (subagents.recent.length > 0) {
        lines.push(` 최근 완료: ${subagents.recent.length}건`)
      }

      box.setContent(lines.join('\n'))
      screen.render()
    }
  }
}
