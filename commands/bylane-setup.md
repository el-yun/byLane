---
name: bylane-setup
description: byLane 최초 설치 및 설정 위자드. GitHub 접근, 이슈 트래커, 알림 채널, 팀 모드, 권한, 루프 모드, 브랜치 네이밍, 모델을 단계별로 설정하여 .bylane/bylane.json을 생성한다.
---

# byLane Setup Wizard

사용자에게 단계별로 질문하여 `.bylane/bylane.json`을 생성한다.
ALWAYS complete all 8 steps before saving. NEVER skip steps.

## 실행 전 준비

1. `.bylane/` 디렉토리가 없으면 생성하고 기본 템플릿을 설치:
   ```bash
   mkdir -p .bylane/state
   npx @elyun/bylane templates install
   ```

2. 기존 bylane.json 있으면 현재 설정을 로드해 기본값으로 사용.

## Step 0/6 — GitHub 접근 방법

사용 가능한 방법을 자동 감지한 뒤 사용자에게 확인한다:

```bash
# MCP 확인: Claude Code 세션에서 GitHub MCP 도구 응답 여부
# CLI 확인
gh auth status 2>/dev/null && echo "cli_ok"
# API 확인
echo ${GITHUB_TOKEN:+api_ok}
```

> GitHub 접근 방법을 선택하세요:
> 1. auto  — MCP → CLI → API 순서로 자동 시도 (권장)
> 2. mcp   — GitHub MCP 도구만 사용
> 3. cli   — gh CLI만 사용
> 4. api   — REST API + GITHUB_TOKEN만 사용

`github.method`에 저장. `cli` 또는 `api` 선택 시 추가 입력:
- `cli`: `gh repo view`로 owner/repo 자동 감지, 실패 시 직접 입력
- `api`: `GITHUB_TOKEN` 환경변수명 확인, owner/repo 입력

## Step 1/6 — 이슈 트래커

사용자에게 묻는다:

> 주 이슈 트래커를 선택하세요:
> 1. GitHub Issues (권장)
> 2. Linear
> 3. 둘 다

- `1` → `trackers.primary = "github"`, `linear.enabled = false`
- `2` → `trackers.primary = "linear"`, Linear API Key 입력 요청
- `3` → `trackers.primary = "both"`, Linear API Key 입력 요청

Linear API Key는 환경변수명(`LINEAR_API_KEY`)으로 저장. 실제 키값은 저장하지 않는다.

## Step 2/6 — 알림 채널

> 완료 알림을 받을 채널을 선택하세요:
> 1. Slack
> 2. Telegram
> 3. 둘 다
> 4. 건너뜀

- Slack 선택 시: 채널명 입력 (예: `#dev-alerts`)
- Telegram 선택 시: Chat ID 입력 방법 안내 후 입력받기
- 건너뜀 → 알림 비활성화

## Step 3/6 — 팀 모드

> 팀 모드를 활성화하시겠습니까? (y/n)

- `y` → 팀원 GitHub 핸들 입력 (쉼표 구분, 예: `@alice, @bob`)
  - 리뷰 할당 방식 질문: `1. round-robin  2. random`
- `n` → `team.enabled = false`

## Step 4/6 — 권한 범위

> Claude가 자동으로 수행할 수 있는 작업 범위를 선택하세요:
> 1. read-only  (분석/리뷰만, 코드 변경 없음)
> 2. write      (코드 작성 + PR 생성, 머지 제외) ← 권장
> 3. full       (머지까지 포함)

`permissions.scope`에 저장.

## Step 5/10 — 이슈 생성 시 브랜치/워크트리

> 이슈 생성 후 자동으로 브랜치를 만들까요? (y/n, 기본: y)

- `y` (기본) → `issue.autoCreateBranch = true` — 이슈 생성 직후 브랜치 네이밍 패턴에 따라 브랜치 자동 생성
- `n` → `issue.autoCreateBranch = false` — code-agent 실행 시 수동 생성

`y` 선택 시 추가 질문:

> 브랜치와 함께 git worktree도 생성할까요? (y/n, 기본: n)
> worktree를 사용하면 이슈별로 독립된 작업 디렉토리가 생성됩니다.
> 여러 이슈를 동시에 작업할 때 유용합니다.

- `y` → `issue.autoCreateWorktree = true` — `.bylane/worktrees/{branch-name}/`에 워크트리 생성
- `n` (기본) → `issue.autoCreateWorktree = false` — 브랜치만 생성하고 checkout

모든 후속 에이전트(code-agent, test-agent, commit-agent 등)는 이슈 번호 기준으로 해당 브랜치/워크트리에서 작업한다.

## Step 6/10 — 리뷰 자동 Approve

> AI 리뷰에서 지적사항이 없을 때 자동으로 Approve할까요? (y/n, 기본: n)

- `n` (기본) → `review.autoApprove = false` — AI는 코멘트만 남기고, Approve는 사람이 직접 판단
- `y` → `review.autoApprove = true` — 지적사항 없으면 AI가 자동 Approve

대부분의 팀에서는 사람이 최종 Approve하는 것을 권장한다.

## Step 7/10 — Loop 실행 모드

> Loop 실행 모드를 선택하세요:
> 1. tmux  — tmux 세션에서 백그라운드 실행 (터미널 종료 후에도 유지, 권장)
> 2. process — 현재 프로세스에서 직접 실행 (잠자기 모드 대응 포함)

- `1` → `loop.mode = "tmux"`, `loop.sessionName` 입력 (Enter = `bylane-loops`)
- `2` → `loop.mode = "process"`

tmux 선택 시 `which tmux`로 설치 여부를 자동 확인한다:
- 설치됨 → `tmux` 모드 확정
- 미설치 → 안내 후 `process` 모드로 자동 전환:
  > tmux가 설치되어 있지 않습니다. process 모드로 설정합니다.
  > tmux 설치: `brew install tmux`

폴링 주기 입력 (Enter = 5분):
- `loop.intervalMs`에 저장 (밀리초)

loop 시작/종료 명령 안내:
```
bylane loop start   # loop 시작
bylane loop stop    # loop 종료
bylane loop status  # 상태 확인
```

## Step 8/10 — 고급 설정

> 고급 설정을 변경하시겠습니까? (Enter = 기본값 사용)

각 항목을 순서대로 묻는다. Enter 입력 시 기본값 유지:
- `maxRetries` (기본: 3): 에이전트 재시도 최대 횟수
- `loopTimeoutMinutes` (기본: 30): 루프 타임아웃 (분)
- Figma MCP 활성화? (y/n, 기본: n)

## Step 9/10 — 브랜치 네이밍

> 브랜치 네이밍 패턴을 선택하세요:
> 1. {tracker}-{issue-number}              예) issues-32
> 2. {tracker}-{issue-number}-{custom-id}  예) issues-32-C-12
> 3. {type}/{issue-number}-{title-slug}    예) feature/32-add-dark-mode
> 4. 직접 입력

사전 정의 패턴 선택 시 해당 토큰 기본값 확인:
- `tracker` 기본값: `issues`
- `type` 기본값: `feature`

직접 입력 시 사용 가능한 토큰 목록 안내:
`{tracker}`, `{type}`, `{issue-number}`, `{custom-id}`, `{title-slug}`, `{date}`, `{username}`

## Step 10/10 — 에이전트 모델 설정

> 각 에이전트에 사용할 AI 모델을 설정하시겠습니까? (Enter = 기본값 사용)

기본값을 보여주고 변경할 항목만 입력받는다:

| 에이전트 | 기본 모델 | 권장 용도 |
|----------|-----------|-----------|
| default | claude-sonnet-4-6 | 미지정 에이전트 fallback |
| orchestrator | claude-opus-4-6 | 의도 파싱, 파이프라인 조율 |
| issue-agent | claude-opus-4-6 | 이슈 생성/분석 |
| code-agent | claude-sonnet-4-6 | 코드 구현 (핵심) |
| test-agent | claude-haiku-4-5-20251001 | 테스트 실행 판단 (경량) |
| commit-agent | claude-haiku-4-5-20251001 | 커밋 메시지 생성 (경량) |
| pr-agent | claude-haiku-4-5-20251001 | PR 본문 생성 (경량) |
| review-agent | claude-sonnet-4-6 | 코드 리뷰 (정밀도 중요) |
| respond-agent | claude-opus-4-6 | 리뷰 대응 (판단력 중요) |
| notify-agent | claude-haiku-4-5-20251001 | 알림 발송 (경량) |

사용 가능한 모델:
- `claude-opus-4-6` — 최고 성능, 높은 비용
- `claude-sonnet-4-6` — 균형 (권장)
- `claude-haiku-4-5-20251001` — 빠르고 저렴

`models.default`만 바꾸면 미지정 에이전트 전체에 적용됨을 안내한다.

## 저장

모든 설정 수집 후:
1. `.bylane/` 디렉토리 확인 및 생성:
   ```bash
   mkdir -p .bylane/state
   ```
2. 수집된 설정을 `.bylane/bylane.json`에 JSON 형식으로 저장
3. 설정 요약을 사용자에게 출력한다.
4. `bylane-monitor` 실행 방법 안내:
   ```
   모니터 대시보드: npm run monitor (byLane 디렉토리에서)
   또는: /bylane monitor
   ```
5. Loop 실행 안내:
   ```
   Loop 시작: npx @elyun/bylane loop start
   Loop 종료: npx @elyun/bylane loop stop
   Loop 상태: npx @elyun/bylane loop status
   ```
