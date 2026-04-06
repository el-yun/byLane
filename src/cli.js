#!/usr/bin/env node
import { mkdirSync, symlinkSync, existsSync, readdirSync, copyFileSync, renameSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CLAUDE_DIR = join(homedir(), '.claude')

const args = process.argv.slice(2)
const command = args[0] || 'install'
const useSymlink = args.includes('--symlink')

// 사용자 설정 파일 — 절대 덮어쓰지 않는다
const USER_CONFIG_FILES = [
  '.bylane/bylane.json',
]

const TARGETS = [
  { src: join(ROOT, 'commands'), dest: join(CLAUDE_DIR, 'commands'), label: 'Commands' },
  { src: join(ROOT, 'hooks'),    dest: join(CLAUDE_DIR, 'hooks'),    label: 'Hooks' },
]

function backupAndCopy(src, dest, file, label) {
  const destFile = join(dest, file)
  const srcFile = join(src, file)

  if (existsSync(destFile)) {
    const srcContent = readFileSync(srcFile)
    const destContent = readFileSync(destFile)
    if (srcContent.equals(destContent)) {
      console.log(`  = ${label}: ${file} (변경 없음, 건너뜀)`)
      return
    }
    const backupPath = `${destFile}.bak`
    renameSync(destFile, backupPath)
    copyFileSync(srcFile, destFile)
    console.log(`  ~ ${label}: ${file} (업데이트됨, 기존 파일 -> ${file}.bak)`)
  } else {
    copyFileSync(srcFile, destFile)
    console.log(`  + ${label}: ${file}`)
  }
}

function registerHooks() {
  const settingsPath = join(CLAUDE_DIR, 'settings.json')
  let settings = {}
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')) } catch {}
  }

  const hookScript = join(CLAUDE_DIR, 'hooks', 'bylane-agent-tracker.js')
  settings.hooks = settings.hooks ?? {}

  // 기존 bylane 훅 제거 후 재등록 (버전 업 시 경로 변경 대응)
  const stripBylane = (arr) =>
    (arr ?? []).filter(h => !h.hooks?.some(hh => hh.command?.includes('bylane-agent-tracker')))

  settings.hooks.PreToolUse = [
    ...stripBylane(settings.hooks.PreToolUse),
    { matcher: 'Agent', hooks: [{ type: 'command', command: `node ${hookScript} pre` }] }
  ]
  settings.hooks.PostToolUse = [
    ...stripBylane(settings.hooks.PostToolUse),
    { matcher: 'Agent', hooks: [{ type: 'command', command: `node ${hookScript} post` }] }
  ]

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  console.log('  ~ Hook: bylane-agent-tracker 등록 (최신 경로로 갱신)')
}

function preservedConfigs() {
  const found = USER_CONFIG_FILES.filter(f => existsSync(f))
  if (found.length > 0) {
    console.log('\n  [보존된 사용자 설정]')
    found.forEach(f => console.log(`  * ${f}`))
  }
}

function isUpdateMode() {
  return existsSync(join(CLAUDE_DIR, 'commands', 'bylane.md'))
}

function install() {
  const updating = isUpdateMode()
  console.log(updating
    ? '\n  byLane 업데이트 중...\n'
    : '\n  byLane 설치 중...\n'
  )

  for (const { src, dest, label } of TARGETS) {
    mkdirSync(dest, { recursive: true })
    const files = readdirSync(src)

    if (useSymlink) {
      for (const file of files) {
        const linkPath = join(dest, file)
        const targetPath = join(src, file)
        if (existsSync(linkPath)) {
          console.log(`  = ${label}: ${file} (심볼릭 링크 이미 존재, 건너뜀)`)
        } else {
          symlinkSync(targetPath, linkPath)
          console.log(`  + ${label}: ${file} -> ${linkPath}`)
        }
      }
    } else {
      for (const file of files) {
        backupAndCopy(src, dest, file, label)
      }
    }
  }

  console.log('')
  registerHooks()
  preservedConfigs()

  if (updating) {
    console.log(`
  byLane 업데이트 완료!

  사용자 설정(.bylane/bylane.json)은 그대로 유지됩니다.
  Claude Code를 재시작하면 변경사항이 적용됩니다.
`)
  } else {
    console.log(`
  byLane 설치 완료!

  다음 단계:
  1. Claude Code를 열고 프로젝트 디렉토리로 이동
  2. 셋업 위자드 실행:

     /bylane setup

  3. 이후 사용:

     /bylane 다크모드 토글 추가해줘
`)
  }
}

if (command === 'install') {
  install()
} else if (command === 'preflight') {
  const { runPreflight, formatPreflight } = await import('./preflight.js')
  const result = runPreflight()
  console.log(formatPreflight(result))
  if (!result.passed) process.exit(1)
} else if (command === 'models') {
  // models → 에이전트별 모델 목록 출력 (KEY=VALUE 형식)
  const { loadConfig, getAgentModel } = await import('./config.js')
  const config = loadConfig()
  const agents = ['orchestrator','issue-agent','code-agent','test-agent',
    'commit-agent','pr-agent','review-agent','respond-agent','notify-agent','analyze-agent']
  agents.forEach(a => console.log(`${a}=${getAgentModel(config, a)}`))
} else if (command === 'branch') {
  // branch ISSUE_NUMBER  → 브랜치명 출력
  const issueNumber = Number(args[1])
  if (!issueNumber) { console.error('사용법: bylane branch <issueNumber>'); process.exit(1) }
  const { buildBranchNameFromConfig } = await import('./branch.js')
  const { loadConfig } = await import('./config.js')
  console.log(buildBranchNameFromConfig(loadConfig(), issueNumber))
} else if (command === 'state') {
  // state write AGENT '{"status":"in_progress",...}'
  // state append AGENT "메시지"
  // state read AGENT
  const subCmd = args[1]
  const agentName = args[2]
  const payload = args[3]
  const { writeState, appendLog, readState } = await import('./state.js')

  if (subCmd === 'write' && agentName && payload) {
    writeState(agentName, JSON.parse(payload))
  } else if (subCmd === 'append' && agentName && payload) {
    appendLog(agentName, payload)
  } else if (subCmd === 'read' && agentName) {
    console.log(JSON.stringify(readState(agentName), null, 2))
  } else {
    console.error('사용법: bylane state <write|append|read> <agentName> [payload]')
    process.exit(1)
  }
} else if (command === 'cleanup') {
  const { runCleanup, formatCleanupResult } = await import('./cleanup.js')
  console.log('\n  byLane 상태 정리 중...\n')
  const result = runCleanup()
  console.log(formatCleanupResult(result))
  console.log('\n  완료.\n')
} else if (command === 'memory') {
  // memory read ISSUE_NUMBER
  // memory append ISSUE_NUMBER AGENT_NAME "content"
  // memory list
  const subCmd = args[1]
  const { loadConfig } = await import('./config.js')
  const { readIssueMemory, appendIssueMemory, listIssueMemories } = await import('./memory.js')
  const config = loadConfig()

  if (subCmd === 'read') {
    const issueNumber = args[2]
    if (!issueNumber) { console.error('사용법: bylane memory read <issueNumber>'); process.exit(1) }
    const content = readIssueMemory(issueNumber, config)
    console.log(content ?? '(메모리 없음)')
  } else if (subCmd === 'append') {
    const issueNumber = args[2]
    const agentName = args[3]
    const content = args[4]
    if (!issueNumber || !agentName || !content) {
      console.error('사용법: bylane memory append <issueNumber> <agentName> "content"')
      process.exit(1)
    }
    appendIssueMemory(issueNumber, agentName, content, config)
    console.log(`  + Issue #${issueNumber} 메모리 기록 완료`)
  } else if (subCmd === 'list') {
    const issues = listIssueMemories(config)
    if (issues.length === 0) {
      console.log('  (기록된 이슈 메모리 없음)')
    } else {
      console.log('  기록된 이슈 메모리:')
      issues.forEach(n => console.log(`  - Issue #${n}`))
    }
  } else {
    console.error('사용법: bylane memory <read|append|list> [issueNumber] [agentName] [content]')
    process.exit(1)
  }
} else if (command === 'loop') {
  const subCmd = args[1] || 'start'
  const { resolveLoopMode, startTmuxLoops, stopTmuxLoops, isTmuxSessionAlive } = await import('./loop-utils.js')
  const { loadConfig } = await import('./config.js')
  const config = loadConfig()
  const sessionName = config.loop?.sessionName ?? 'bylane-loops'

  if (subCmd === 'start') {
    const mode = resolveLoopMode()

    if (mode === 'tmux') {
      startTmuxLoops(sessionName)
      console.log(`\n  tmux 세션에 접속하려면: tmux attach -t ${sessionName}\n`)
    } else {
      // process 모드: 현재 프로세스에서 직접 실행
      console.log('\n  process 모드: review-loop + respond-loop 실행\n')
      const { spawn } = await import('child_process')
      const review = spawn(process.execPath, ['src/review-loop.js'], { stdio: 'inherit', detached: false })
      const respond = spawn(process.execPath, ['src/respond-loop.js'], { stdio: 'inherit', detached: false })

      function shutdownAll() {
        review.kill('SIGTERM')
        respond.kill('SIGTERM')
        process.exit(0)
      }
      process.on('SIGINT', shutdownAll)
      process.on('SIGTERM', shutdownAll)

      // 자식 프로세스가 모두 종료되면 부모도 종료
      let exited = 0
      const onExit = () => { if (++exited >= 2) process.exit(0) }
      review.on('exit', onExit)
      respond.on('exit', onExit)
    }
  } else if (subCmd === 'stop') {
    let stopped = false

    // 1) tmux 세션 종료 시도 (모드 무관)
    if (isTmuxSessionAlive(sessionName)) {
      stopTmuxLoops(sessionName)
      stopped = true
    }

    // 2) process 모드 PID 종료 시도 (모드 무관)
    const { readState, writeState } = await import('./state.js')
    for (const loopName of ['review-loop', 'respond-loop']) {
      const state = readState(loopName)
      if (!state?.pid) continue
      const pid = Number(state.pid)
      try {
        process.kill(pid, 0) // PID 살아있는지 확인
        process.kill(pid, 'SIGTERM')
        writeState(loopName, { ...state, status: 'stopped', stoppedAt: new Date().toISOString() })
        console.log(`  ${loopName} (PID: ${pid}) 종료`)
        stopped = true
      } catch {
        console.log(`  ${loopName} (PID: ${pid}) 이미 종료됨`)
      }
    }

    if (!stopped) {
      console.log('  실행 중인 루프가 없습니다.')
    }
  } else if (subCmd === 'status') {
    const alive = isTmuxSessionAlive(sessionName)
    const { readState } = await import('./state.js')
    const reviewState = readState('review-loop')
    const respondState = readState('respond-loop')
    const mode = resolveLoopMode()
    console.log(`\n  모드: ${mode}`)
    console.log(`  tmux 세션 (${sessionName}): ${alive ? '실행 중' : '없음'}`)
    console.log(`  review-loop: ${reviewState?.status ?? 'unknown'}${reviewState?.pid ? ` (PID: ${reviewState.pid})` : ''}`)
    console.log(`  respond-loop: ${respondState?.status ?? 'unknown'}${respondState?.pid ? ` (PID: ${respondState.pid})` : ''}\n`)
  } else {
    console.error('사용법: bylane loop <start|stop|status>')
    process.exit(1)
  }
} else if (command === 'monitor') {
  // 항상 현재 패키지의 모니터 실행 (버전 일치 보장)
  const monitorPath = join(__dirname, 'monitor', 'index.js')
  const { spawn } = await import('child_process')
  const child = spawn(process.execPath, [monitorPath], { stdio: 'inherit' })
  child.on('exit', code => process.exit(code ?? 0))
} else {
  console.error(`알 수 없는 명령: ${command}`)
  console.error('사용법: npx @elyun/bylane [install|loop|monitor|preflight|state|memory|cleanup] [--symlink]')
  process.exit(1)
}
