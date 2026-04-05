# byLane

> Claude Code용 프론트엔드 개발 자동화 하네스

GitHub Issues에서 시작해 코드 구현, 테스트, 커밋, PR 생성, 리뷰, 리뷰 반영까지 전체 개발 워크플로우를 에이전트 기반으로 자동화합니다.

## 특징

- **프로젝트 분석** — 코드 스타일·디자인 토큰·아키텍처를 자동 분석해 `.claude/instructions/`에 저장, CLAUDE.md에 자동 import
- **전체 워크플로우 자동화** — `/bylane 다크모드 토글 추가해줘` 한 줄로 이슈 생성부터 PR까지
- **개별 실행 가능** — 각 에이전트를 단독으로 실행 가능
- **실시간 모니터링** — 2열 그리드 터미널 TUI 대시보드
- **자동 리뷰 루프** — 5분 주기로 review 요청 PR 자동 리뷰
- **자동 대응 루프** — 5분 주기로 내 PR 리뷰/코멘트 자동 대응 (accept/rebut)
- **피드백 루프** — 테스트 실패 시 자동 재시도 (설정 가능)
- **GitHub 접근 방법** — MCP / CLI(`gh`) / REST API 자동 감지
- **리뷰 템플릿** — 코드 예시, 모델 명시, 커스텀 푸터 설정 가능
- **에이전트별 모델 설정** — 에이전트마다 다른 AI 모델 지정 가능
- **Figma MCP 연동** — 이슈의 Figma 링크에서 스펙 자동 추출 (선택적)
- **Slack / Telegram 알림** — 완료 또는 개입 필요 시 알림
- **pre-commit 보안 훅** — 시크릿/민감 파일/console.log 자동 검사

## 요구사항

- [Claude Code](https://claude.ai/code) CLI
- Node.js 20+
- GitHub MCP (Claude Code 기본 제공), `gh` CLI, 또는 `GITHUB_TOKEN` 중 하나
- Slack MCP / Telegram (알림 사용 시)
- Figma MCP (디자인 연동 사용 시)

## 설치

### npx로 설치 (권장)

```bash
npx @elyun/bylane
```

Skills, Commands, Hooks 파일을 `~/.claude/` 하위 디렉토리에 자동으로 복사합니다.
기존 파일이 있으면 `.bak`으로 백업 후 교체합니다.

심볼릭 링크로 설치하면 레포 업데이트 시 자동으로 반영됩니다:

```bash
npx @elyun/bylane --symlink
```

### 수동 설치

```bash
git clone https://github.com/el-yun/byLane.git
cd byLane
npm install   # pre-commit 보안 훅 자동 등록
node src/cli.js install
```

### 셋업 위자드 실행

Claude Code를 열고 프로젝트 디렉토리에서:

```
/bylane setup
```

7단계 인터랙티브 설정:
1. GitHub 접근 방법 (MCP / CLI / API / auto)
2. 이슈 트래커 (GitHub Issues / Linear / 둘 다)
3. 알림 채널 (Slack / Telegram / 둘 다)
4. 팀 모드 설정
5. 권한 범위 (read-only / write / full)
6. 고급 설정 (재시도 횟수, 타임아웃, Figma MCP)
7. 브랜치 네이밍 패턴
8. 에이전트별 AI 모델

## 사용법

### 전체 워크플로우

자연어로 작업 내용을 설명하면 오케스트레이터가 적절한 에이전트를 자동으로 실행합니다.

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
/bylane review [PR번호]          PR 리뷰
/bylane review-loop              5분 주기 자동 리뷰 루프
/bylane respond [PR번호]         리뷰 반박/반영
/bylane respond-loop             5분 주기 자동 대응 루프
/bylane notify                   알림 발송
/bylane status                   현재 상태 요약
```

### 자동 루프

두 루프를 동시에 실행하면 review 요청과 리뷰 대응을 모두 자동화합니다:

```bash
node src/review-loop.js &   # 내게 요청된 PR 자동 리뷰
node src/respond-loop.js &  # 내 PR 리뷰 자동 대응
```

### 모니터 대시보드

```bash
npm run monitor
# 또는
/bylane monitor
```

```
+---------------------------+--------------------------------------+
|  AGENT PIPELINE           |  AGENT LOG                 [LIVE]  |
|                           |                                     |
|  issue-agent  [v] 완료   |  17:32:38 code-agent               |
|  code-agent   [>] 67%    |    > ThemeToggle.tsx 생성           |
|  test-agent   [ ] 대기   |  17:30:09 issue-agent              |
|  ...                      |    > spec.json 저장됨               |
+---------------------------+--------------------------------------+
|  QUEUE                    |  SYSTEM STATUS                      |
|  1  Issue #124  대기중    |  GitHub    OK 연결됨                |
|  2  PR #45  review        |  Slack     OK #dev-alerts           |
+---------------------------+--------------------------------------+
```

## 프로젝트 분석 (analyze)

`/bylane analyze`를 실행하면 현재 프로젝트를 자동 분석하여 Claude Code가 참조할 수 있는 instruction 파일을 생성합니다.

### 생성되는 파일

| 파일 | 내용 |
|---|---|
| `.claude/instructions/code-style.md` | 언어, 포맷팅, 네이밍 컨벤션, import 규칙, 금지 패턴 |
| `.claude/instructions/design-tokens.md` | 색상 팔레트, 타이포그래피, 간격, 브레이크포인트, 다크모드 |
| `.claude/instructions/architecture.md` | 프레임워크, 렌더링 전략, 상태관리, 데이터 페칭, 폴더 구조 |

### 동작 방식

1. ESLint/Prettier/tsconfig, Tailwind config, CSS 변수, package.json 등 설정 파일을 자동 탐색
2. 소스 파일을 샘플링하여 실제 사용 패턴 파악
3. 분석 결과를 `.claude/instructions/`에 Markdown 파일로 저장
4. `CLAUDE.md`에 `@.claude/instructions/*.md` import 구문 자동 추가
   - `CLAUDE.md`가 없으면 `/init`으로 먼저 생성

```
/bylane analyze          # 분석 후 파일 생성 (기존 파일 확인 요청)
/bylane analyze --force  # 기존 instruction 파일 강제 덮어쓰기
```

커스텀 내용은 `.claude/instructions/structure.md`를 직접 작성하고 CLAUDE.md에 `@.claude/instructions/structure.md`를 추가하면 재분석 시에도 유지됩니다.

## 브랜치 네이밍 패턴

| 패턴 | 예시 |
|---|---|
| `{tracker}-{issue-number}` | `issues-32` |
| `{tracker}-{issue-number}-{custom-id}` | `issues-32-C-12` |
| `{type}/{issue-number}-{title-slug}` | `feature/32-add-dark-mode` |

사용 가능한 토큰: `{tracker}`, `{type}`, `{issue-number}`, `{custom-id}`, `{title-slug}`, `{date}`, `{username}`

빈 토큰은 자동으로 제외됩니다 (`{custom-id}` 없으면 `issues-32`).

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
    "test-agent": "claude-haiku-4-5-20251001",
    "commit-agent": "claude-haiku-4-5-20251001",
    "pr-agent": "claude-haiku-4-5-20251001",
    "notify-agent": "claude-haiku-4-5-20251001"
  },
  "review": {
    "model": "claude-sonnet-4-6",
    "language": "ko",
    "includeModel": true,
    "includeCodeExample": true,
    "templateFile": "",
    "footer": "Reviewed by byLane · model: {model}"
  },
  "extensions": {
    "figma": { "enabled": false, "useAt": "issue-analysis" }
  }
}
```

## 에이전트 파이프라인

```
orchestrator
  → issue-agent    (이슈 생성/분석, Figma 스펙 추출)
  → code-agent     (코드 구현)
  → test-agent     (테스트 실행, 실패 시 code-agent 재시도)
  → commit-agent   (브랜치 생성 + 커밋)
  → pr-agent       (PR 생성)
  → review-agent   (자동 리뷰)
  → respond-agent  (리뷰 반박 또는 반영)
  → notify-agent   (Slack/Telegram 알림)

review-loop   (독립 실행: 5분 주기 리뷰 요청 감지)
respond-loop  (독립 실행: 5분 주기 리뷰 코멘트 감지)
```

## GitHub 접근 방법

`github.method` 설정으로 제어:

| 값 | 동작 |
|----|------|
| `"auto"` (기본) | MCP → CLI → API 순서로 자동 시도 |
| `"mcp"` | GitHub MCP 도구만 사용 |
| `"cli"` | `gh` CLI만 사용 |
| `"api"` | REST API + `$GITHUB_TOKEN`만 사용 |

## 리뷰 템플릿

`templates/review-template.md`를 복사해 커스터마이즈한 뒤 `review.templateFile`에 경로를 지정합니다.

기본 구성: 심각도 레이블 (CRITICAL/HIGH/MEDIUM/LOW), Before/After 코드 예시, 사용 모델 명시, 커스텀 푸터.

## 보안

`npm install` 시 pre-commit 훅이 자동 등록됩니다. 커밋마다 아래를 검사합니다:

| 항목 | 심각도 |
|------|--------|
| AWS/OpenAI/GitHub/Slack/Google 키 패턴 | CRITICAL (차단) |
| `.env`, `.pem`, `credentials` 등 민감 파일 | CRITICAL (차단) |
| 하드코딩된 password/api_key | CRITICAL (차단) |
| `node_modules` 실수 커밋 | CRITICAL (차단) |
| `console.log` | WARN (경고만) |

우회: `git commit --no-verify`

## 개발

```bash
npm install          # 의존성 설치 + pre-commit 훅 등록
npm test             # 테스트 실행 (19개)
npm run monitor      # 모니터 대시보드
npm version minor    # 버전 올리기
npm run release      # npm 배포 (커밋/푸시 후 실행)
```

## 라이선스

MIT
