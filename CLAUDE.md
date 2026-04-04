# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

byLane — Claude Code용 프론트엔드 개발 자동화 하네스.
오케스트레이터 + 워커 에이전트 패턴으로 GitHub 이슈 생성부터 PR 머지까지 자동화.

## 커맨드

```bash
# 의존성 설치
npm install

# 전체 테스트 실행
npm test

# 모니터 대시보드 실행
npm run monitor

# 테스트용 더미 상태 생성
node -e "import('./src/state.js').then(({writeState})=>writeState('code-agent',{status:'in_progress',progress:50,retries:0,startedAt:new Date().toISOString(),log:[]}))"
```

## 아키텍처

- `src/state.js` — `.bylane/state/*.json` 읽기/쓰기 유틸 (writeState, readState, clearState, listStates, appendLog)
- `src/config.js` — `.bylane/bylane.json` 로드/저장/검증 (loadConfig, saveConfig, validateConfig, DEFAULT_CONFIG)
- `src/branch.js` — 브랜치명 패턴 엔진 (buildBranchName, buildBranchNameFromConfig)
- `src/monitor/` — blessed 기반 TUI 대시보드 (2열 그리드, 1초 폴링)
- `skills/` — Claude Code 에이전트 skill 파일들
- `hooks/` — 외부 이벤트 자동 감지 훅
- `commands/` — `/bylane` 슬래시 커맨드 정의

## 에이전트 파이프라인

```
orchestrator → issue-agent → code-agent → test-agent → commit-agent
            → pr-agent → review-agent → respond-agent → notify-agent
```

각 에이전트는 `.bylane/state/{name}.json`에 상태 기록. 모니터가 1초마다 폴링.

## 상태 파일 스키마

```json
{
  "agent": "code-agent",
  "status": "in_progress | completed | failed | idle",
  "startedAt": "ISO8601",
  "progress": 0,
  "retries": 0,
  "log": [{ "ts": "ISO8601", "msg": "string" }]
}
```

## 브랜치 네이밍 토큰

`{tracker}`, `{type}`, `{issue-number}`, `{custom-id}`, `{title-slug}`, `{date}`, `{username}`

빈 토큰은 자동으로 제외됨:
- `{tracker}-{issue-number}-{custom-id}` + custom-id 없음 → `issues-32`
- `{tracker}-{issue-number}-{custom-id}` + custom-id=C-12 → `issues-32-C-12`

## 테스트 구조

```
tests/
├── state.test.js   — writeState, readState, clearState, listStates, appendLog
├── config.test.js  — loadConfig, saveConfig, validateConfig, DEFAULT_CONFIG
└── branch.test.js  — buildBranchName (5개 패턴 케이스)
```
