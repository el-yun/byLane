# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

byLane — Claude Code용 프론트엔드 개발 자동화 하네스.
오케스트레이터 + 워커 에이전트 패턴으로 GitHub 이슈 생성부터 PR 머지까지 자동화.

## 커맨드

```bash
npm install          # 의존성 설치 + pre-commit 훅 자동 등록 (prepare 스크립트)
npm test             # 테스트 실행 (43개)
npm run monitor      # 모니터 대시보드
npm version minor    # 마이너 버전 올리기 (커밋 + 태그 자동 생성)
npm run release      # npm 배포 (커밋/푸시 완료 후 실행)

# 테스트용 더미 상태 생성
node -e "import('./src/state.js').then(({writeState})=>writeState('code-agent',{status:'in_progress',progress:50,retries:0,startedAt:new Date().toISOString(),log:[]}))"

# 에이전트별 모델 확인
node -e "import('./src/config.js').then(({loadConfig,getAgentModel})=>{const c=loadConfig();['orchestrator','code-agent','review-agent'].forEach(a=>console.log(a,getAgentModel(c,a)))})"

# Loop 관리
npx @elyun/bylane loop start   # review-loop + respond-loop 시작 (tmux 또는 process)
npx @elyun/bylane loop stop    # loop 종료
npx @elyun/bylane loop status  # 실행 상태 확인

# issueMemory 확인
npx @elyun/bylane memory list
npx @elyun/bylane memory read 123
```

## 아키텍처

- `src/state.js` — `.bylane/state/*.json` 읽기/쓰기 유틸 (writeState, readState, clearState, listStates, appendLog)
- `src/config.js` — `.bylane/bylane.json` 로드/저장/검증 (loadConfig, saveConfig, validateConfig, getAgentModel, DEFAULT_CONFIG)
- `src/branch.js` — 브랜치명 패턴 엔진 (buildBranchName, buildBranchNameFromConfig)
- `src/memory.js` — 이슈별 컨텍스트 메모리 유틸 (readIssueMemory, appendIssueMemory, listIssueMemories)
- `src/cli.js` — npx 설치 CLI (install, loop, --symlink 옵션, 기존 파일 .bak 백업, Stop 훅 등록)
- `src/loop-utils.js` — 루프 공통 유틸 (killExistingLoop, tmux 세션 관리, createAbsoluteTimer, resolveLoopMode)
- `src/queue-utils.js` — 큐 상태 관리 유틸 (reconcileQueue, expireStaleItems, gcQueue, maintainQueue)
- `src/pipeline.js` — 파이프라인 상태 추적 (startPipeline, updatePipelineStep, cancelStalePipeline, blockDownstreamOfFailed)
- `src/review-loop.js` — review 요청 PR 폴러 → `.bylane/state/review-queue.json` (절대시간 기반 폴링, 큐 reconcile/GC 포함)
- `src/respond-loop.js` — 내 PR 리뷰/코멘트 폴러 → `.bylane/state/respond-queue.json` (절대시간 기반 폴링, 큐 reconcile/GC 포함)
- `src/monitor/` — blessed 기반 TUI 대시보드 (2열 그리드, 1초 폴링, fullUnicode)
- `skills/` — Claude Code 에이전트 skill 파일들
- `hooks/` — 외부 이벤트 자동 감지 훅
- `commands/` — `/bylane` 슬래시 커맨드 정의
- `templates/review-template.md` — 리뷰 코멘트 기본 템플릿
- `scripts/release.sh` — npm 배포 스크립트 (dirty 체크 + 테스트 + publish)
- `hooks/bylane-session-cleanup.js` — Stop 훅 (세션 종료 시 in_progress→cancelled, 루프/큐 상태 정리)
- `.githooks/pre-commit` — 보안 검사 훅 (시크릿/민감파일/console.log)

## 에이전트 파이프라인

```
orchestrator → issue-agent → code-agent → test-agent → commit-agent
            → pr-agent → review-agent → respond-agent → notify-agent

analyze-agent (독립: 프로젝트 분석 → .claude/instructions/ 생성)
review-loop   (독립: 설정 주기로 review 요청 감지, 절대시간 기반 폴링)
respond-loop  (독립: 설정 주기로 리뷰 코멘트 감지, 절대시간 기반 폴링)
```

각 에이전트는 `.bylane/state/{name}.json`에 상태 기록. 모니터가 1초마다 폴링.

## Loop 실행

`bylane loop start` / `bylane loop stop` / `bylane loop status`

두 가지 모드 (`config.loop.mode`):

| 모드 | 설명 | 해결하는 문제 |
|------|------|-------------|
| `tmux` (기본) | tmux 세션에서 백그라운드 실행 | 터미널 종료, SSH 끊김 시 프로세스 유지 |
| `process` | 현재 프로세스에서 직접 실행 | tmux 미설치 환경 대응 |

두 모드 모두 **절대시간 기반 폴링** 사용:
- 10초마다 "마지막 폴링 후 intervalMs 경과 여부" 체크
- macOS 잠자기 모드 동안은 CPU 정지로 실행 불가 (OS 제약)
- 잠자기 해제 직후 경과 시간 감지 → 즉시 폴링 실행
- preflight에서 tmux 미설치 감지 시 자동으로 process 모드 fallback

설정: `config.loop.intervalMs` (기본 300000 = 5분), `config.loop.sessionName` (기본 `bylane-loops`)

## 상태 파일 스키마

```json
{
  "agent": "code-agent",
  "status": "in_progress | completed | failed | cancelled | blocked | idle",
  "startedAt": "ISO8601",
  "progress": 0,
  "retries": 0,
  "log": [{ "ts": "ISO8601", "msg": "string" }]
}
```

### 큐 항목 상태 값

`pending` → `reviewing`/`responding` → `resolved` | `expired` (GC 후 제거)

큐 reconcile: 매 poll마다 GitHub 상태와 대조하여 불필요한 pending 항목을 resolved로 전환.
TTL: 24시간 초과 pending → expired. GC: resolved/expired 후 1시간 경과 시 큐에서 제거.

### 파이프라인 상태 (`pipeline.json`)

```json
{
  "agent": "pipeline",
  "status": "in_progress | completed | failed | cancelled",
  "pipelineType": "A | B | C_review | C_respond | D",
  "currentStep": "code-agent",
  "steps": [{ "agent": "code-agent", "status": "completed" }, ...]
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
├── state.test.js        — writeState, readState, clearState, listStates, appendLog (6개)
├── config.test.js       — loadConfig, saveConfig, validateConfig, DEFAULT_CONFIG (7개)
├── branch.test.js       — buildBranchName (6개 패턴 케이스, 슬래시 엣지케이스 포함)
├── queue-utils.test.js  — reconcileQueue, expireStaleItems, gcQueue, maintainQueue (10개)
└── pipeline.test.js     — startPipeline, updatePipelineStep, cancelStalePipeline, blockDownstreamOfFailed (14개)
```

## 주의사항

- `.bylane/state/`는 .gitignore로 제외됨 (런타임 상태)
- `.bylane/memory/`는 .gitignore로 제외됨 (issueMemory 로컬 파일)
- `.bylane/bylane.json`은 추적됨 (프로젝트 설정)
- `docs/`는 .gitignore로 제외됨 (내부 설계 문서)
- pre-commit 훅: `npm install` 시 자동 등록 (`prepare` 스크립트)
- issueMemory: 루프 비활성 시 로컬 파일, 루프 실행 중 GitHub 이슈 코멘트로 기록
