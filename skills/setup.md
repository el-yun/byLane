---
name: bylane-setup
description: byLane 하네스 최초 설치 및 설정 위자드. /bylane setup 으로 실행.
---

# byLane Setup Wizard

사용자에게 단계별로 질문하여 `.bylane/bylane.json`을 생성한다.
ALWAYS complete all 6 steps before saving. NEVER skip steps.

## 실행 전 준비

1. `.bylane/` 디렉토리가 없으면 생성:
   ```bash
   mkdir -p .bylane/state
   ```

2. 기존 bylane.json 있으면 현재 설정을 로드해 기본값으로 사용.

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

## Step 5/6 — 고급 설정

> 고급 설정을 변경하시겠습니까? (Enter = 기본값 사용)

각 항목을 순서대로 묻는다. Enter 입력 시 기본값 유지:
- `maxRetries` (기본: 3): 에이전트 재시도 최대 횟수
- `loopTimeoutMinutes` (기본: 30): 루프 타임아웃 (분)
- Figma MCP 활성화? (y/n, 기본: n)

## Step 6/6 — 브랜치 네이밍

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
