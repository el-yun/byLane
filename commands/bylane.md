---
name: bylane
description: byLane 메인 진입점. 자연어 명령을 키워드 감지하여 적절한 에이전트로 자동 라우팅한다. 복합 의도는 오케스트레이터로 전달.
---

# /bylane

## 사용법

```
/bylane [자연어 명령]
```

자연어로 개발 의도를 전달하면 키워드를 감지해 적절한 에이전트를 자동 실행한다.
서브커맨드 없이 **자연어만** 받는다. 개별 에이전트는 `/bylane-*`로 직접 실행한다.

### 개별 에이전트 직접 실행

| 커맨드 | 설명 |
|---|---|
| `/bylane-setup` | GitHub 접근, 이슈 트래커, 알림, 팀 모드, 루프, 브랜치, 모델을 단계별로 설정하여 `.bylane/bylane.json` 생성 |
| `/bylane-monitor` | blessed 기반 TUI 대시보드 실행 안내. 에이전트 상태/큐/로그를 1초 주기로 표시 |
| `/bylane-cleanup` | 파일 권한 수정, 죽은 PID 정리, 30분 초과 작업 실패 전환, 큐 pending 복구를 일괄 실행 |
| `/bylane-analyze-agent` | 코드 스타일/디자인 토큰/아키텍처를 분석하여 `.claude/instructions/`에 저장, CLAUDE.md에 import 추가 |
| `/bylane-issue-agent` | 코드베이스 병렬 분석 + 사용자 문답으로 전략 스펙 포함 GitHub 이슈 작성. code-agent 입력이 됨 |
| `/bylane-code-agent` | 이슈 전략 스펙 기반으로 브랜치 생성 + 코드 구현. issueMemory 기록, 실패 시 피드백 재시도 |
| `/bylane-test-agent` | 테스트 실행 후 PASS/FAIL 반환. FAIL 시 failureDetails를 state에 기록하여 재시도 피드백 제공 |
| `/bylane-commit-agent` | 변경 파일 분석 → conventional commit(feat/fix/refactor) 메시지 자동 생성. 시크릿 자동 제외 |
| `/bylane-pr-agent` | 전체 커밋 히스토리 분석 → PR 제목/요약/테스트 계획 자동 작성. 팀 모드 시 리뷰어 할당 |
| `/bylane-review-agent` | PR diff를 파일별 분석 → 라인별 인라인 코멘트. grammar/domain/code/security 검사, 심각도 분류 |
| `/bylane-respond-agent` | 리뷰 코멘트 분석 → accept(코드 수정+재커밋) 또는 rebut(근거 반박). CHANGES_REQUESTED 포함 처리 |
| `/bylane-review-loop` | 설정 주기로 review 요청 PR 감지 → review-queue 기록 → review-agent 자동 실행. 재요청 포함 |
| `/bylane-respond-loop` | 설정 주기로 내 PR 리뷰/코멘트 감지 → respond-queue 기록 → respond-agent 자동 실행. 재감지 포함 |
| `/bylane-notify-agent` | 워크플로우 완료/테스트 실패/리뷰 대기/개입 필요 시 Slack/Telegram 알림 발송 |

## 사전 점검 (자동 실행)

키워드 라우팅 전 아래 점검을 실행한다:

```bash
npx @elyun/bylane preflight
```

점검 항목:
- `.bylane/bylane.json` 존재 여부 → 없으면 `bylane-setup` 스킬 실행 후 중단
- GitHub 접근 방법 (`github.method` 기준):
  - `cli`: `gh auth status` → 로그인 안 됐으면 `gh auth login` 안내
  - `api`: `GITHUB_TOKEN` 환경변수 → 없으면 설정 방법 안내
  - `auto`/`mcp`: CLI + Token 둘 다 확인, 어느 것도 없으면 안내
- 알림 채널 (활성화된 경우만): Slack 채널 설정 여부, Telegram 토큰 여부

문제가 있으면 각 항목마다 수정 방법을 출력하고 중단한다.
**셋업/상태 관련 키워드는 점검 없이 바로 실행한다.**

## 키워드 감지 및 라우팅

입력된 자연어에서 키워드를 감지하여 적절한 스킬로 라우팅한다.
반드시 아래 표의 **"실행 스킬" 전체 이름**을 Skill 도구에 전달한다.
**매칭되는 키워드가 없거나 복합 의도이면 `bylane-orchestrator`로 전달한다.**

### 유틸리티 (점검 생략)

| 키워드 | 실행 스킬 | 예시 입력 |
|---|---|---|
| `setup`, `셋업`, `설정 위자드`, `초기 설정`, `설치` | `bylane-setup` | "셋업 다시 해줘", "초기 설정" |
| `monitor`, `모니터`, `대시보드`, `dashboard` | `bylane-monitor` | "모니터 켜줘", "대시보드 보고 싶어" |
| `cleanup`, `정리`, `상태 초기화`, `리셋`, `reset` | `bylane-cleanup` | "상태 정리해줘", "리셋" |
| `status`, `상태`, `현황`, `지금 뭐 하고 있어` | 상태 요약 출력 | "상태 보여줘", "현황 알려줘" |
| `preflight`, `점검`, `연동 확인`, `헬스체크` | preflight 실행 | "점검해줘", "연동 확인" |

### 분석

| 키워드 | 실행 스킬 | 예시 입력 |
|---|---|---|
| `analyze`, `분석`, `프로젝트 분석`, `코드 분석`, `구조 분석` | `bylane-analyze-agent` | "프로젝트 분석해줘", "코드 구조 파악해줘" |

### 이슈 & 구현

| 키워드 | 실행 스킬 | 예시 입력 |
|---|---|---|
| `이슈 만들어`, `이슈 작성`, `이슈 생성`, `issue 생성` | `bylane-issue-agent` | "이슈 만들어줘", "버그 이슈 작성" |
| `#N 구현`, `이슈 #N`, `코드 작성`, `코딩`, `구현` + 이슈번호 | `bylane-code-agent` | "#32 구현해줘", "이슈 #15 코딩" |

### 테스트 & 커밋 & PR

| 키워드 | 실행 스킬 | 예시 입력 |
|---|---|---|
| `test`, `테스트`, `검증`, `테스트 돌려`, `시험` | `bylane-test-agent` | "테스트 돌려줘", "검증해줘" |
| `commit`, `커밋`, `커밋해`, `변경사항 저장` | `bylane-commit-agent` | "커밋해줘", "변경사항 커밋" |
| `pr`, `PR`, `풀리퀘`, `풀 리퀘스트`, `PR 생성`, `PR 만들어` | `bylane-pr-agent` | "PR 만들어줘", "풀리퀘 올려줘" |

### 리뷰 & 대응

| 키워드 | 실행 스킬 | 예시 입력 |
|---|---|---|
| `리뷰해`, `코드 리뷰`, `review` + PR번호 | `bylane-review-agent` | "PR #45 리뷰해줘", "코드 리뷰 해줘" |
| `반영`, `반박`, `대응`, `respond`, `수정 반영`, `리뷰 수락` | `bylane-respond-agent` | "리뷰 반영해줘", "#45 반박해" |
| `리뷰 루프`, `자동 리뷰`, `리뷰 자동화`, `review loop` | `bylane-review-loop` | "자동 리뷰 시작", "리뷰 루프 켜줘" |
| `대응 루프`, `자동 대응`, `대응 자동화`, `respond loop` | `bylane-respond-loop` | "자동 대응 시작", "대응 루프 시작" |
| `루프 시작`, `loop start`, `루프 켜`, `자동화 시작` | `bylane-review-loop` + `bylane-respond-loop` 순차 실행 | "루프 시작해줘", "자동화 켜" |
| `루프 종료`, `loop stop`, `루프 꺼`, `자동화 중단` | 루프 종료 안내 | "루프 꺼줘", "자동화 중단" |

### 알림

| 키워드 | 실행 스킬 | 예시 입력 |
|---|---|---|
| `notify`, `알림`, `알려줘`, `슬랙`, `텔레그램`, `통보` | `bylane-notify-agent` | "슬랙에 알림 보내줘" |

### 복합 의도 → 오케스트레이터

아래 경우는 `bylane-orchestrator`로 전달한다:
- 키워드가 2개 이상 카테고리에 걸칠 때 ("이슈 만들고 구현까지 해줘")
- 기능 요청 자연어 ("다크모드 토글 추가해줘", "로그인 페이지 만들어줘")
- 매칭되는 키워드가 없을 때

## 라우팅 우선순위

1. **유틸리티 키워드** — setup, monitor, cleanup, status, preflight
2. **루프 키워드** — 리뷰 루프, 대응 루프, 루프 시작/종료
3. **단일 에이전트 키워드** — review, commit, test, pr 등
4. **복합 의도 / 자연어** → `bylane-orchestrator`

## status 동작

`.bylane/state/*.json` 파일을 읽어 각 에이전트의 현재 상태를 한 줄로 출력:

```
orchestrator: idle | issue-agent: completed | code-agent: in_progress(67%) | ...
```
