# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

byLane — Claude Code용 프론트엔드 개발 자동화 하네스.
오케스트레이터 + 워커 에이전트 패턴으로 GitHub 이슈 생성부터 PR 머지까지 자동화.

## 커맨드

```bash
npm install          # 의존성 설치 + pre-commit 훅 자동 등록 (prepare 스크립트)
npm test             # 테스트 실행 (19개)
npm run monitor      # 모니터 대시보드
npm version minor    # 마이너 버전 올리기 (커밋 + 태그 자동 생성)
npm run release      # npm 배포 (커밋/푸시 완료 후 실행)

# 테스트용 더미 상태 생성
node -e "import('./src/state.js').then(({writeState})=>writeState('code-agent',{status:'in_progress',progress:50,retries:0,startedAt:new Date().toISOString(),log:[]}))"

# 에이전트별 모델 확인
node -e "import('./src/config.js').then(({loadConfig,getAgentModel})=>{const c=loadConfig();['orchestrator','code-agent','review-agent'].forEach(a=>console.log(a,getAgentModel(c,a)))})"
```

## 아키텍처

- `src/state.js` — `.bylane/state/*.json` 읽기/쓰기 유틸 (writeState, readState, clearState, listStates, appendLog)
- `src/config.js` — `.bylane/bylane.json` 로드/저장/검증 (loadConfig, saveConfig, validateConfig, getAgentModel, DEFAULT_CONFIG)
- `src/branch.js` — 브랜치명 패턴 엔진 (buildBranchName, buildBranchNameFromConfig)
- `src/cli.js` — npx 설치 CLI (install, --symlink 옵션, 기존 파일 .bak 백업)
- `src/review-loop.js` — 5분 주기 review 요청 PR 폴러 → `.bylane/state/review-queue.json`
- `src/respond-loop.js` — 5분 주기 내 PR 리뷰/코멘트 폴러 → `.bylane/state/respond-queue.json`
- `src/monitor/` — blessed 기반 TUI 대시보드 (2열 그리드, 1초 폴링, fullUnicode)
- `skills/` — Claude Code 에이전트 skill 파일들
- `hooks/` — 외부 이벤트 자동 감지 훅
- `commands/` — `/bylane` 슬래시 커맨드 정의
- `templates/review-template.md` — 리뷰 코멘트 기본 템플릿
- `scripts/release.sh` — npm 배포 스크립트 (dirty 체크 + 테스트 + publish)
- `.githooks/pre-commit` — 보안 검사 훅 (시크릿/민감파일/console.log)

## 에이전트 파이프라인

```
orchestrator → issue-agent → code-agent → test-agent → commit-agent
            → pr-agent → review-agent → respond-agent → notify-agent

analyze-agent (독립: 프로젝트 분석 → .claude/instructions/ 생성)
review-loop   (독립: 5분 주기 review 요청 감지)
respond-loop  (독립: 5분 주기 리뷰 코멘트 감지)
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

## GitHub 접근 방법

`github.method`: `"auto"` (기본, MCP→CLI→API 순) | `"mcp"` | `"cli"` | `"api"`

## 에이전트 모델 설정

`config.models` 객체에서 에이전트별 모델 지정. `getAgentModel(config, agentName)`으로 조회.
기본값: orchestrator/issue-agent/respond-agent/analyze-agent → opus-4-6, code-agent/review-agent → sonnet-4-6, 나머지 → haiku-4-5.

## 브랜치 네이밍 토큰

`{tracker}`, `{type}`, `{issue-number}`, `{custom-id}`, `{title-slug}`, `{date}`, `{username}`

빈 토큰은 자동 제외: `{type}/{issue-number}` + type 없음 → `32-add-dark-mode`

## 테스트 구조

```
tests/
├── state.test.js   — writeState, readState, clearState, listStates, appendLog
├── config.test.js  — loadConfig, saveConfig, validateConfig, DEFAULT_CONFIG
└── branch.test.js  — buildBranchName (6개 패턴 케이스, 슬래시 엣지케이스 포함)
```

## 주의사항

- `.bylane/state/`는 .gitignore로 제외됨 (런타임 상태)
- `.bylane/bylane.json`은 추적됨 (프로젝트 설정)
- `docs/`는 .gitignore로 제외됨 (내부 설계 문서)
- pre-commit 훅: `npm install` 시 자동 등록 (`prepare` 스크립트)
