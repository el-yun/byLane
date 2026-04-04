# byLane — Frontend Development Harness for Claude Code

**Date:** 2026-04-04  
**Status:** Draft  

---

## 1. 목적

byLane은 Claude Code 위에서 동작하는 프론트엔드 개발 자동화 하네스다. GitHub Issues(또는 Linear)에서 시작해 코드 구현, 테스트, 커밋, PR 생성, 리뷰, 리뷰 반영까지 전체 개발 워크플로우를 에이전트 기반으로 자동화한다.

각 에이전트는 독립 실행도 가능하고, 타인의 원격 작업(이슈, PR, 리뷰 등)을 대상으로도 동작한다.

---

## 2. 핵심 결정 사항

| 항목 | 결정 |
|---|---|
| 배포 형태 | Skills 파일 세트 (`~/.claude/` 하위), 별도 인프라 없음 |
| 트리거 방식 | 혼합 — `/bylane [자연어]` slash command + 자연어 감지 |
| 에이전트 아키텍처 | 오케스트레이터 + 워커 에이전트 패턴 |
| 이슈 트래커 | GitHub Issues 주, Linear 선택적 |
| 알림 | Slack / Telegram 선택 (설치 시 설정) |
| Figma MCP | 선택적 활성화 — 이슈 분석 단계에서 스펙 추출 |
| 피드백 루프 | 기본값 3회 + 사용자 설정 오버라이드 |
| 모니터링 | `/bylane monitor` — 2열 그리드 터미널 TUI 대시보드 |

---

## 3. 전체 아키텍처

```
byLane/
├── skills/
│   ├── orchestrator.md          # 전체 워크플로우 총괄
│   ├── setup.md                 # 최초 설치 셋업 위자드
│   ├── monitor.md               # 실시간 터미널 대시보드
│   │
│   ├── issue-agent.md           # 이슈 생성/분석 (GitHub + Linear)
│   ├── code-agent.md            # 코드 구현 (Figma MCP 선택적)
│   ├── test-agent.md            # 테스트 실행 및 검증
│   ├── commit-agent.md          # 커밋 생성
│   ├── pr-agent.md              # PR 생성/관리
│   ├── review-agent.md          # PR 리뷰 수행
│   ├── respond-agent.md         # 리뷰 반박/반영
│   └── notify-agent.md          # 최종 알림 (Slack/Telegram)
│
├── hooks/
│   ├── post-tool-use.md         # 외부 이벤트 감지 (타인의 PR, 리뷰)
│   └── natural-language.md      # 자연어 트리거 감지
│
├── config/
│   └── bylane.json              # 설치 시 생성되는 설정 파일
│
└── commands/
    ├── bylane.md                # /bylane 메인 커맨드
    └── bylane-monitor.md        # /bylane-monitor 대시보드
```

---

## 4. 워크플로우

### 오케스트레이터 동작 방식

`/bylane [자연어]` 실행 시 오케스트레이터가 의도를 파싱하여 어디서 시작하고 어디서 끝낼지 결정한다.

```
/bylane 다크모드 토글 추가해줘
  → issue-agent (이슈 생성) → code-agent → test-agent → commit-agent
  → pr-agent → review-agent → notify-agent

/bylane issue #123 구현해줘
  → issue-agent (분석만) → code-agent → ... → notify-agent

/bylane PR #45 리뷰해줘
  → review-agent만 실행

/bylane 리뷰 #45 반영해줘
  → respond-agent만 실행
```

### 전체 파이프라인

```
[진입점]
  /bylane [자연어]  OR  자연어 감지  OR  외부 이벤트 (hooks)
       │
       ▼
[orchestrator] ── 의도 파악 + bylane.json 설정 로드
       │
       ├─► [issue-agent]    이슈 분석, Figma 링크 있으면 스펙 추출
       │         ↓
       ├─► [code-agent]     구현 (Figma 스펙 참조)
       │         ↓
       ├─► [test-agent]     테스트 실행
       │         ↕ FAIL 시 code-agent로 피드백 루프 (최대 maxRetries)
       │         ↓ PASS
       ├─► [commit-agent]   커밋 생성
       │         ↓
       ├─► [pr-agent]       PR 생성
       │         ↓
       ├─► [review-agent]   자동 리뷰
       │         ↓
       ├─► [respond-agent]  반박 or 반영 → LGTM까지 루프
       │         ↓
       └─► [notify-agent]   Slack/Telegram 완료 알림
```

### 에이전트 역할

| 에이전트 | 트리거 | 입력 | 출력 |
|---|---|---|---|
| **orchestrator** | `/bylane`, 자연어 | 사용자 의도 | 에이전트 실행 계획 |
| **issue-agent** | 수동 or 오케스트레이터 | 이슈 텍스트/번호 | 구현 스펙 JSON |
| **code-agent** | 수동 or 오케스트레이터 | 스펙 + 코드베이스 | 변경된 파일들 |
| **test-agent** | 수동 or 코드 완료 후 | 변경 파일들 | 통과/실패 + 피드백 |
| **commit-agent** | 수동 or 테스트 통과 후 | 변경 파일들 | 커밋 SHA |
| **pr-agent** | 수동 or 커밋 후 | 커밋 목록 | PR URL |
| **review-agent** | 수동 or PR 오픈 후 | PR diff | 리뷰 코멘트 |
| **respond-agent** | 수동 or 리뷰 수신 후 | 리뷰 코멘트 | 반박/수정 커밋 |
| **notify-agent** | 수동 or 워크플로우 완료 | 결과 요약 | Slack/Telegram 메시지 |

### 피드백 루프 규칙

```
루프 최대 횟수: bylane.json의 maxRetries (기본값: 3)
에스컬레이션 조건:
  - maxRetries 초과 시
  - 에이전트가 "해결 불가" 판단 시
에스컬레이션: notify-agent로 "개입 필요" 알림 후 대기
```

### 외부 이벤트 처리

```
hooks/post-tool-use → GitHub PR 오픈 감지    → review-agent 자동 실행
                    → 리뷰 코멘트 수신 감지   → respond-agent 자동 실행
                    → CI 실패 감지            → code-agent 재실행
```

---

## 5. 슬래시 커맨드

| 커맨드 | 동작 |
|---|---|
| `/bylane [자연어]` | 오케스트레이터 — 전체 워크플로우 자동 실행 |
| `/bylane setup` | 셋업 위자드 (재실행 가능) |
| `/bylane monitor` | 실시간 TUI 대시보드 |
| `/bylane issue [#번호 or 텍스트]` | issue-agent 단독 실행 |
| `/bylane code [#번호]` | code-agent 단독 실행 |
| `/bylane test` | test-agent 단독 실행 |
| `/bylane commit` | commit-agent 단독 실행 |
| `/bylane pr` | pr-agent 단독 실행 |
| `/bylane review [PR번호]` | review-agent 단독 실행 |
| `/bylane respond [PR번호]` | respond-agent 단독 실행 |
| `/bylane notify` | notify-agent 단독 실행 |
| `/bylane status` | 현재 워크플로우 상태 한 줄 요약 |

---

## 6. 모니터링 대시보드 (`/bylane monitor`)

2열 그리드 터미널 TUI. Node.js `blessed` 또는 `ink` 기반.

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  byLane Monitor   Issue #123: "Add dark mode toggle"   Elapsed: 4m 31s  17:32:41║
╠═══════════════════════════════════════╦════════════════════════════════════════ ║
║  AGENT PIPELINE                       ║  AGENT LOG                    [LIVE]   ║
║                                       ║                                         ║
║  issue-agent   [✓] 완료    2m 12s    ║  17:32:38 code-agent                   ║
║  code-agent    [▶] 실행중  ████░ 67% ║    → ThemeToggle.tsx 생성              ║
║  test-agent    [○] 대기               ║  17:32:35 code-agent                   ║
║  commit-agent  [○] 대기               ║    → useTheme hook 구현 중...          ║
║  pr-agent      [○] 대기               ║  17:32:21 code-agent                   ║
║  review-agent  [○] 대기               ║    → Figma color token 로드            ║
║  respond-agent [○] 대기               ║  17:30:09 issue-agent                  ║
║  notify-agent  [○] 대기               ║    → ✓ 완료 - spec.json 저장됨         ║
║                                       ║  17:28:14 orchestrator                 ║
║  Retries: 1/3   maxRetries: 3        ║    → workflow 시작 (Issue #123)        ║
╠═══════════════════════════════════════╬════════════════════════════════════════╣
║  QUEUE                                ║  SYSTEM STATUS                          ║
║                                       ║                                         ║
║  #  TYPE        TARGET    STATUS      ║  GitHub       ✓ 연결됨                 ║
║  1  Issue #124  code      대기중      ║  Linear       ✗ 비활성                 ║
║  2  PR #45      review    대기중      ║  Figma MCP    ✓ 활성                   ║
║  3  Issue #125  full-flow 예약됨      ║  Slack        ✓ #dev-alerts            ║
║                                       ║  Telegram     ✗ 미설정                 ║
║                                       ║                                         ║
║                                       ║  팀 모드      ✓ 활성 (3명)             ║
║                                       ║  권한 범위    write (코드/PR)           ║
╚═══════════════════════════════════════╩════════════════════════════════════════╝
  [q]종료  [p]일시정지  [c]현재작업취소  [Tab]포커스전환  [↑↓]로그스크롤  [?]도움말
```

**패널 구성:**

| 패널 | 위치 | 내용 |
|---|---|---|
| Header | 상단 전체 | 현재 작업명 + 경과시간 + 시각 |
| Agent Pipeline | 좌상 | 파이프라인 상태 + 재시도 현황 |
| Agent Log | 우상 | 실시간 로그 스크롤 (최근 50줄) |
| Queue | 좌하 | 대기/예약 작업 목록 |
| System Status | 우하 | 연동 서비스 상태 + 설정 요약 |
| Footer | 하단 전체 | 키보드 단축키 |

**데이터 소스:** `.bylane/state/*.json` 파일 폴링(1초 간격)

---

## 7. 셋업 위자드 (`/bylane setup`)

최초 설치 또는 재설정 시 실행. 6단계 인터랙티브 프롬프트.

```
1/6  이슈 트래커       GitHub Issues (주) / Linear (선택) / 둘 다
2/6  알림 채널         Slack / Telegram / 둘 다 / 건너뜀
3/6  팀 모드           활성화 여부 + 팀원 GitHub 핸들 입력
4/6  권한 범위         read-only / write(코드+PR) / full(머지 포함)
5/6  고급 설정         maxRetries (기본 3), Figma MCP 활성화, 루프 타임아웃
6/6  브랜치 네이밍     패턴 선택 또는 커스텀 토큰 조합
```

---

## 8. 설정 파일 (`bylane.json`)

```json
{
  "version": "1.0",
  "trackers": {
    "primary": "github",
    "linear": { "enabled": false, "apiKey": "$LINEAR_API_KEY" }
  },
  "notifications": {
    "slack": { "enabled": true, "channel": "#dev-alerts" },
    "telegram": { "enabled": false, "chatId": "" }
  },
  "team": {
    "enabled": true,
    "members": ["@alice", "@bob"],
    "reviewAssignment": "round-robin"
  },
  "permissions": {
    "scope": "write",
    "allowMerge": false,
    "allowForceClose": false
  },
  "workflow": {
    "maxRetries": 3,
    "loopTimeoutMinutes": 30,
    "autoEscalate": true
  },
  "branch": {
    "pattern": "{tracker}-{issue-number}-{custom-id}",
    "tokens": {
      "tracker": "issues",
      "type": "feature",
      "custom-id": ""
    },
    "separator": "-",
    "caseStyle": "kebab-case"
  },
  "extensions": {
    "figma": {
      "enabled": true,
      "useAt": "issue-analysis"
    }
  }
}
```

**브랜치 네이밍 토큰:**

| 토큰 | 예시 |
|---|---|
| `{tracker}` | `issues`, `feat` |
| `{issue-number}` | `32` |
| `{custom-id}` | `C-12` (비어있으면 토큰 제외) |
| `{type}` | `feature`, `fix` |
| `{title-slug}` | `add-dark-mode` |
| `{date}` | `20260404` |
| `{username}` | `jhyoon` |

**패턴 예시:**
- `{tracker}-{issue-number}-{custom-id}` → `issues-32-C-12` 또는 `issues-32`
- `{type}/{issue-number}-{title-slug}` → `feature/32-add-dark-mode`

---

## 9. 상태 관리

각 에이전트는 작업 중 `.bylane/state/{agent-name}.json`에 상태를 기록한다.

```json
{
  "agent": "code-agent",
  "status": "in_progress",
  "startedAt": "2026-04-04T17:28:10Z",
  "progress": 67,
  "currentTask": "ThemeToggle.tsx 구현 중",
  "retries": 1,
  "log": [
    { "ts": "17:32:38", "msg": "ThemeToggle.tsx 생성" },
    { "ts": "17:32:35", "msg": "useTheme hook 구현 중..." }
  ]
}
```

---

## 10. 구현 스택

| 항목 | 선택 |
|---|---|
| 하네스 형태 | Claude Code skills/agents/hooks 파일 세트 |
| MCP 의존성 | GitHub MCP, Figma MCP (선택), Slack MCP, Telegram MCP |
| 대시보드 | Node.js + `blessed` 또는 `ink` (터미널 TUI) |
| 상태 저장 | `.bylane/state/*.json` (파일 기반) |
| 설정 | `.bylane/bylane.json` |
| 외부 인프라 | 없음 |
