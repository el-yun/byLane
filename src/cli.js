#!/usr/bin/env node
import { cpSync, mkdirSync, symlinkSync, existsSync, readdirSync, copyFileSync, renameSync } from 'fs'
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
  { src: join(ROOT, 'skills'),   dest: join(CLAUDE_DIR, 'skills'),   label: 'Skills' },
  { src: join(ROOT, 'commands'), dest: join(CLAUDE_DIR, 'commands'),  label: 'Commands' },
  { src: join(ROOT, 'hooks'),    dest: join(CLAUDE_DIR, 'hooks'),     label: 'Hooks' },
]

function backupAndCopy(src, dest, file, label) {
  const destFile = join(dest, file)
  const srcFile = join(src, file)

  if (existsSync(destFile)) {
    const backupPath = `${destFile}.bak`
    renameSync(destFile, backupPath)
    copyFileSync(srcFile, destFile)
    console.log(`  ~ ${label}: ${file} (기존 파일 -> ${file}.bak)`)
  } else {
    copyFileSync(srcFile, destFile)
    console.log(`  + ${label}: ${file}`)
  }
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
