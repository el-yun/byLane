# byLane

> Claude Code용 개발 자동화 하네스

GitHub Issues에서 시작해 코드 구현, 테스트, 커밋, PR 생성, 리뷰, 리뷰 반영까지 전체 개발 워크플로우를 에이전트 기반으로 자동화합니다.

---

## 핵심 기능

| 기능 | 설명 |
|------|------|
| **전체 워크플로우** | 자연어 한 줄로 이슈 → 코드 → 테스트 → 커밋 → PR 자동화 |
| **issueMemory** | 이슈별 작업 컨텍스트(아키텍처 결정, 트러블슈팅 등) 자동 기록 및 재활용 |
| **프로젝트 분석** | 코드 스타일·디자인 토큰·아키텍처 자동 분석, `.claude/instructions/` 생성 |
| **인라인 코드 리뷰** | 변경 라인마다 개별 코멘트 + GitHub suggestion 블록 자동 등록 |
| **자동 리뷰 루프** | 5분 주기로 review 요청된 PR을 자동 감지 → 리뷰 실행 |
| **자동 대응 루프** | 5분 주기로 내 PR 리뷰/코멘트 감지 → 자동 수정 반영 또는 반박 |
| **실시간 모니터** | 터미널 TUI 대시보드 (에이전트 상태, 로그, 큐, 루프 모니터링) |
| **에이전트별 모델** | 에이전트마다 다른 Claude 모델 지정 가능 |
| **GitHub 자동 감지** | MCP → CLI(`gh`) → REST API 순서로 자동 시도 |
| **보안 훅** | 커밋마다 시크릿/민감 파일/console.log 자동 검사 |

---

## 요구사항

- [Claude Code](https://claude.ai/code) CLI
- Node.js 20+
- GitHub MCP (Claude Code 기본 제공) / `gh` CLI / `GITHUB_TOKEN` 중 하나
- Slack MCP 또는 Telegram (알림 사용 시, 선택사항)
- Figma MCP (디자인 연동 사용 시, 선택사항)

---

## 설치

### npx로 설치 (권장)

```bash
npx @elyun/bylane
```

`~/.claude/commands/`와 `~/.claude/hooks/`에 파일을 자동 복사합니다.
기존 파일은 `.bak`으로 백업 후 교체됩니다.
`.bylane/bylane.json` 사용자 설정은 **절대 덮어쓰지 않습니다**.

심볼릭 링크 설치 (레포 업데이트 시 자동 반영):

```bash
npx @elyun/bylane --symlink
```

### 수동 설치

```bash
git clone https://github.com/el-yun/byLane.git
cd byLane
npm install
node src/cli.js install
```

### 셋업 위자드

설치 후 Claude Code에서 프로젝트 디렉토리로 이동:

```
/bylane setup
```

인터랙티브 설정 (GitHub 접근 방법, 알림 채널, 브랜치 패턴, 에이전트 모델 등).

### 사전 점검

설정이 올바른지 확인하려면:

```bash
npx @elyun/bylane preflight
```

또는 Claude Code에서:

```
/bylane preflight
```

점검 항목: bylane.json 존재, GitHub CLI 로그인, GITHUB_TOKEN, Slack/Telegram 연동 설정.
문제가 있으면 항목마다 수정 방법을 안내합니다.

```
── byLane 사전 점검 ──

✓  bylane 설정              v1.0
✓  GitHub CLI (fallback)   github.com
!  GitHub Token (fallback)  GITHUB_TOKEN 환경변수 없음
     → export GITHUB_TOKEN=ghp_xxxx
```

모든 에이전트 실행 전 자동으로 점검하여 연동 오류로 인한 중간 실패를 방지합니다.

---

## 사용법

### 전체 워크플로우

```
/bylane 다크모드 토글 버튼 추가해줘
/bylane issue #123 구현해줘
/bylane PR #45 리뷰해줘
/bylane 리뷰 #45 반영해줘
```

### 개별 에이전트 실행

```
/bylane analyze                  프로젝트 분석 → .claude/instructions/ 생성
/bylane issue [#번호 | 텍스트]   이슈 생성/분석
/bylane code [#번호]             코드 구현
/bylane test                     테스트 실행
/bylane commit                   커밋 생성
/bylane pr                       PR 생성
/bylane review [#PR번호] [scope] PR 인라인 리뷰
/bylane respond [#PR번호] [모드] 리뷰 반박/반영
/bylane notify                   알림 발송
/bylane status                   현재 상태 요약
```

### 자동 루프

두 루프를 동시에 실행하면 리뷰 요청과 리뷰 대응을 완전 자동화합니다:

```bash
node src/review-loop.js &   # 내게 요청된 PR 자동 리뷰 (5분 주기)
node src/respond-loop.js &  # 내 PR 리뷰 자동 대응 (5분 주기)
```

루프 종료:

```bash
kill $(pgrep -f review-loop.js)
kill $(pgrep -f respond-loop.js)
# 또는 모니터에서 [s]
```

Claude Code에서 실행:

```
/bylane review-loop     자동 리뷰 루프 시작 (검사 범위 선택 후 시작)
/bylane respond-loop    자동 대응 루프 시작
```

---

## 모니터 대시보드

```bash
npx @elyun/bylane monitor
```

> `npx`를 사용하면 항상 최신 버전이 실행됩니다. 로컬 구버전이 실행되지 않습니다.

```
+-----------------------------+--------------------------------------+
|  AGENT PIPELINE             |  AGENT LOG                  [LIVE]  |
|                             |                                      |
|  [>] code-agent   12s  ##-- |  17:32:38 code-agent                |
|  [ ] test-agent   대기      |    > ThemeToggle.tsx 생성            |
|  [v] issue-agent            |  17:30:09 issue-agent               |
|                             |    > spec.json 저장됨                |
|  LOOPS                      |                                      |
|  [>] review-loop  45s       |                                      |
|  [-] respond-loop 미실행    |                                      |
|                             |                                      |
|  SUBAGENTS                  |                                      |
|  [>] executor  8s  코드...  |                                      |
+-----------------------------+--------------------------------------+
|  QUEUE                      |  SYSTEM STATUS                       |
|  PR #45  review pending     |  GitHub    OK                        |
|  PR #48  respond pending    |  Loops     1 running                 |
+-----------------------------+--------------------------------------+
 [q]종료  [c]에이전트취소토글  [s]루프종료  [Tab]포커스  [j/k]로그스크롤
```

### 단축키

| 키 | 동작 |
|----|------|
| `q` / `Ctrl+C` | 모니터 종료 |
| `r` | 상태 정리 (권한 수정, 좀비 초기화, 큐 복구) |
| `c` | 하위 에이전트 취소 플래그 토글 (새 Agent 호출 차단) |
| `s` | 실행 중인 루프 선택 → SIGTERM 전송 |
| `Tab` | 패널 포커스 이동 |
| `j` / `k` | 로그 스크롤 |

---

## 코드 리뷰

### 검사 범위 선택

리뷰 실행 시 검사 항목을 선택합니다. 선택 없이 Enter → 전체 검사:

```
검사 항목을 선택하세요 (쉼표 구분, Enter=전체):
  1. grammar  — 문법, 오탈자, 주석/변수명 언어 일관성
  2. domain   — 비즈니스 로직, 도메인 규칙 준수 여부
  3. code     — 코드 스타일, 컨벤션, 중복, 복잡도
  4. security — 보안 취약점, 시크릿 노출, 인증/인가 이슈
```

인자로도 지정 가능:
```
/bylane review #45 code,security
```

### 인라인 코멘트

모든 리뷰 코멘트는 **해당 코드 라인에 직접** 등록됩니다. 수정 제안이 있으면 GitHub suggestion 블록으로 작성되어 "Apply suggestion" 버튼으로 바로 적용할 수 있습니다.

```
제목

설명

```suggestion
// 수정 제안 코드
```
```

### GitHub 리뷰 템플릿 우선 적용

프로젝트에 아래 파일이 있으면 해당 형식을 **최우선**으로 따릅니다:

```
.github/REVIEW_TEMPLATE.md
.github/CODE_REVIEW_TEMPLATE.md
docs/REVIEW_TEMPLATE.md
```

없으면 `templates/review-template.md`를 사용합니다.

---

## 리뷰 대응 (respond)

| 모드 | 동작 |
|------|------|
| `auto` (기본) | 각 코멘트를 분석해 수정 반영 또는 반박을 자동 판단, 요약 확인 후 실행 |
| `accept` | 모든 코멘트 수정 반영 |
| `rebut` | 모든 코멘트 반박 |
| `manual` | 코멘트별로 수정/반박/건너뜀 직접 선택 |

```
/bylane respond #45           auto 모드 (기본)
/bylane respond #45 manual    코멘트별 수동 선택
/bylane respond #45 accept    전체 반영
```

auto 모드에서는 실행 전 요약을 먼저 보여주고 확인을 받습니다:

```
코멘트 #1: [반영] null 체크 누락 → 코드 수정
코멘트 #2: [반박] 의도된 설계 (이슈 #12 참조)
진행할까요? (y/n)
```

---

## issueMemory

이슈 단위로 작업 컨텍스트를 자동으로 기록하고, 다음 세션에서 재활용합니다.

### 동작 방식

- **루프 비활성 시** — `.bylane/memory/issues/{이슈번호}.md` 로컬 파일에 기록
- **루프 실행 중** — GitHub 이슈 코멘트로 기록 (팀 전체가 볼 수 있도록)

기록 내용: 작업 요약, 변경 파일, 아키텍처 결정, 트러블슈팅 내역

### 자동 기록

issue-agent와 code-agent가 작업 완료 후 자동으로 기록합니다. 별도 설정 불필요.

code-agent는 작업 시작 시 이전 세션의 메모리를 불러와 일관된 아키텍처 결정을 유지합니다.

### 수동 사용

```bash
npx @elyun/bylane memory read 123       # 이슈 #123 메모리 조회
npx @elyun/bylane memory list           # 메모리가 있는 이슈 목록
npx @elyun/bylane memory append 123 code-agent "메모 내용"  # 직접 추가
```

### 설정

`.bylane/bylane.json`:

```json
{
  "memory": {
    "enabled": true,
    "dir": ".bylane/memory"
  }
}
```

`enabled: false`로 비활성화할 수 있습니다.

---

## 프로젝트 분석

`/bylane analyze` 실행 시 현재 프로젝트를 자동 분석하여 Claude Code가 참조할 instruction 파일을 생성합니다.

| 파일 | 내용 |
|------|------|
| `.claude/instructions/code-style.md` | 언어, 포맷팅, 네이밍 컨벤션, import 규칙 |
| `.claude/instructions/design-tokens.md` | 색상, 타이포그래피, 간격, 다크모드 |
| `.claude/instructions/architecture.md` | 프레임워크, 상태관리, 폴더 구조 |

ESLint/Prettier/tsconfig, Tailwind config, CSS 변수 등 설정 파일을 자동 탐색하고 실제 소스 패턴을 샘플링합니다. 분석 후 `CLAUDE.md`에 import 구문을 자동 추가합니다.

```
/bylane analyze          기존 파일 있으면 확인 요청
/bylane analyze --force  강제 덮어쓰기
```

---

## 에이전트 파이프라인

```
orchestrator
  → issue-agent    이슈 생성/분석, Figma 스펙 추출 (선택)
  → code-agent     코드 구현
  → test-agent     테스트 실행, 실패 시 code-agent 재시도
  → commit-agent   브랜치 생성 + 커밋
  → pr-agent       PR 생성
  → review-agent   인라인 코드 리뷰
  → respond-agent  리뷰 반박 또는 반영
  → notify-agent   Slack/Telegram 알림

analyze-agent   독립: 프로젝트 분석 → .claude/instructions/ 생성
review-loop     독립: 5분 주기 review 요청 감지
respond-loop    독립: 5분 주기 리뷰 코멘트 감지
```

각 에이전트는 `.bylane/state/{name}.json`에 상태를 기록합니다. 모니터가 1초마다 폴링합니다.

---

## 설정 파일 (`.bylane/bylane.json`)

```json
{
  "version": "1.0",
  "github": {
    "method": "auto",
    "owner": "",
    "repo": ""
  },
  "trackers": {
    "primary": "github",
    "linear": { "enabled": false, "apiKey": "" }
  },
  "notifications": {
    "slack": { "enabled": true, "channel": "#dev-alerts" },
    "telegram": { "enabled": false, "chatId": "" }
  },
  "workflow": {
    "maxRetries": 3,
    "loopTimeoutMinutes": 30,
    "autoEscalate": true
  },
  "branch": {
    "pattern": "{tracker}-{issue-number}",
    "tokens": { "tracker": "issues", "type": "feature", "custom-id": "" },
    "caseStyle": "kebab-case"
  },
  "models": {
    "default": "claude-sonnet-4-6",
    "orchestrator": "claude-opus-4-6",
    "issue-agent": "claude-opus-4-6",
    "code-agent": "claude-sonnet-4-6",
    "review-agent": "claude-sonnet-4-6",
    "respond-agent": "claude-opus-4-6",
    "analyze-agent": "claude-opus-4-6",
    "test-agent": "claude-haiku-4-5-20251001",
    "commit-agent": "claude-haiku-4-5-20251001",
    "pr-agent": "claude-haiku-4-5-20251001",
    "notify-agent": "claude-haiku-4-5-20251001"
  },
  "review": {
    "model": "claude-sonnet-4-6",
    "language": "ko",
    "includeCodeExample": true,
    "templateFile": "",
    "footer": "{model} · {date}"
  },
  "memory": {
    "enabled": true,
    "dir": ".bylane/memory"
  },
  "extensions": {
    "figma": { "enabled": false, "useAt": "issue-analysis" }
  }
}
```

### 브랜치 네이밍 토큰

| 토큰 | 설명 |
|------|------|
| `{tracker}` | 트래커 종류 (예: `issues`) |
| `{type}` | 작업 타입 (예: `feature`, `fix`) |
| `{issue-number}` | 이슈 번호 |
| `{custom-id}` | 커스텀 ID |
| `{title-slug}` | 이슈 제목 슬러그 |
| `{date}` | 날짜 (YYYYMMDD) |
| `{username}` | GitHub 사용자명 |

값이 없는 토큰은 자동으로 제외됩니다 (`{custom-id}` 없으면 `issues-32-add-dark-mode`).

---

## 주의사항

### 업데이트 시 설정 보존

```bash
npx @elyun/bylane   # 재설치/업데이트
```

`.bylane/bylane.json` 사용자 설정은 절대 덮어쓰지 않습니다. 나머지 파일은 `.bak`으로 백업 후 교체됩니다.

### 모니터 버전 불일치

프로젝트의 `node_modules`에 구버전이 설치된 경우 `npm run monitor`를 사용하면 구버전이 실행됩니다.
항상 `npx @elyun/bylane monitor`를 사용하세요.

### 루프 중복 실행

review-loop / respond-loop는 PID를 상태 파일에 기록합니다. 모니터의 `[s]` 키 또는 `pgrep`으로 확인 후 종료하세요.

### GitHub MCP vs CLI

Claude Code 세션 내에서는 MCP가 자동 사용됩니다. 루프 폴러(`review-loop.js`, `respond-loop.js`)는 Claude 세션 외부에서 실행되므로 `gh` CLI 또는 `GITHUB_TOKEN`이 필요합니다.

### 상태 정리 (cleanup)

에이전트 크래시, 루프 강제 종료, 권한 문제 등으로 상태가 꼬인 경우 정리 명령을 실행합니다:

```bash
npx @elyun/bylane cleanup
```

또는 모니터에서 **`[r]`** 키를 누르면 즉시 실행됩니다.

| 정리 항목 | 동작 |
|-----------|------|
| `.bylane/state/` 권한 | 디렉토리 755, 파일 644로 수정 |
| 죽은 루프 프로세스 | PID 확인 → 없으면 `stopped`로 전환 |
| 30분 초과 `in_progress` | `failed`로 초기화 |
| `subagents.json` active | PID 없는 항목 제거 |
| 큐의 `reviewing`/`responding` | `pending`으로 복구 (재처리 대기) |

정리 후 상태 파일이 갱신되면 chokidar가 감지하여 모니터에 즉시 반영됩니다.

### 하위 에이전트 제어

모니터에서 `[c]`를 누르면 `.bylane/state/cancel.json`이 생성되어 새 하위 에이전트 호출이 차단됩니다. 다시 `[c]`를 누르면 해제됩니다.

---

## 보안

`npm install` 시 pre-commit 훅이 자동 등록됩니다.

| 검사 항목 | 처리 |
|-----------|------|
| AWS/OpenAI/GitHub/Slack/Google 키 패턴 | 커밋 차단 |
| `.env`, `.pem`, `credentials` 등 민감 파일 | 커밋 차단 |
| 하드코딩된 password/api_key | 커밋 차단 |
| `node_modules` 실수 커밋 | 커밋 차단 |
| `console.log` | 경고 (차단 안 함) |

우회: `git commit --no-verify` (권장하지 않음)

---

## 개발

```bash
npm install          # 의존성 설치 + pre-commit 훅 등록
npm test             # 테스트 실행 (19개)
npm run monitor      # 모니터 대시보드 (소스에서 직접 실행)
npm version minor    # 버전 올리기 (커밋 + 태그 자동 생성)
npm run release      # npm 배포 (커밋/푸시 완료 후 실행)
```

---

## 라이선스

MIT
