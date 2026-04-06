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
    console.log(`  ~ ${label}: ${file} (기존 파일 -> ${file}.bak)`)
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

  // PreToolUse
  settings.hooks.PreToolUse = settings.hooks.PreToolUse ?? []
  const preExists = settings.hooks.PreToolUse.some(h =>
    h.hooks?.some(hh => hh.command?.includes('bylane-agent-tracker'))
  )
  if (!preExists) {
    settings.hooks.PreToolUse.push({
      matcher: 'Agent',
      hooks: [{ type: 'command', command: `node ${hookScript} pre` }]
    })
    console.log('  + Hook: PreToolUse/Agent → bylane-agent-tracker')
  } else {
    console.log('  = Hook: PreToolUse/Agent (이미 등록됨)')
  }

  // PostToolUse
  settings.hooks.PostToolUse = settings.hooks.PostToolUse ?? []
  const postExists = settings.hooks.PostToolUse.some(h =>
    h.hooks?.some(hh => hh.command?.includes('bylane-agent-tracker'))
  )
  if (!postExists) {
    settings.hooks.PostToolUse.push({
      matcher: 'Agent',
      hooks: [{ type: 'command', command: `node ${hookScript} post` }]
    })
    console.log('  + Hook: PostToolUse/Agent → bylane-agent-tracker')
  } else {
    console.log('  = Hook: PostToolUse/Agent (이미 등록됨)')
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

function install() {
  console.log('\n  byLane 설치 중...\n')

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

if (command === 'install') {
  install()
} else {
  console.error(`알 수 없는 명령: ${command}`)
  console.error('사용법: npx bylane [install] [--symlink]')
  process.exit(1)
}
