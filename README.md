# byLane

> Claude Code용 프론트엔드 개발 자동화 하네스

GitHub Issues에서 시작해 코드 구현, 테스트, 커밋, PR 생성, 리뷰, 리뷰 반영까지 전체 개발 워크플로우를 에이전트 기반으로 자동화합니다.

## 특징

- **전체 워크플로우 자동화** — `/bylane 다크모드 토글 추가해줘` 한 줄로 이슈 생성부터 PR까지
- **개별 실행 가능** — 각 에이전트를 단독으로 실행 가능
- **실시간 모니터링** — 2열 그리드 터미널 TUI 대시보드
- **피드백 루프** — 테스트 실패 시 자동 재시도 (설정 가능)
- **Figma MCP 연동** — 이슈의 Figma 링크에서 스펙 자동 추출 (선택적)
- **Slack / Telegram 알림** — 완료 또는 개입 필요 시 알림

## 요구사항

- [Claude Code](https://claude.ai/code) CLI
- Node.js 20+
- GitHub MCP (Claude Code 기본 제공)
- Slack MCP / Telegram (알림 사용 시)
- Figma MCP (디자인 연동 사용 시)

## 설치

### 1. 레포지토리 클론

```bash
git clone https://github.com/YOUR_USERNAME/byLane.git
cd byLane
npm install
```

### 2. Claude Code에 Skills 등록

Skills, Hooks, Commands 파일을 Claude Code가 인식할 수 있는 위치에 복사합니다.

```bash
# Skills 복사
mkdir -p ~/.claude/skills
cp skills/*.md ~/.claude/skills/

# Commands 복사
mkdir -p ~/.claude/commands
cp commands/*.md ~/.claude/commands/

# Hooks 복사
mkdir -p ~/.claude/hooks
cp hooks/*.md ~/.claude/hooks/
```

또는 심볼릭 링크로 연결 (업데이트 시 자동 반영):

```bash
ln -s $(pwd)/skills ~/.claude/skills/bylane
ln -s $(pwd)/commands/bylane.md ~/.claude/commands/bylane.md
ln -s $(pwd)/commands/bylane-monitor.md ~/.claude/commands/bylane-monitor.md
ln -s $(pwd)/hooks/post-tool-use.md ~/.claude/hooks/bylane-post-tool-use.md
```

### 3. 셋업 위자드 실행

Claude Code를 열고 프로젝트 디렉토리에서:

```
/bylane setup
```

6단계 인터랙티브 설정:
1. 이슈 트래커 (GitHub Issues / Linear / 둘 다)
2. 알림 채널 (Slack / Telegram / 둘 다)
3. 팀 모드 설정
4. 권한 범위 (read-only / write / full)
5. 고급 설정 (재시도 횟수, 타임아웃, Figma MCP)
6. 브랜치 네이밍 패턴

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
/bylane issue [#번호 | 텍스트]   이슈 생성/분석
/bylane code [#번호]             코드 구현
/bylane test                     테스트 실행
/bylane commit                   커밋 생성
/bylane pr                       PR 생성
/bylane review [PR번호]          PR 리뷰
/bylane respond [PR번호]         리뷰 반박/반영
/bylane notify                   알림 발송
/bylane status                   현재 상태 요약
```

### 모니터 대시보드

```bash
npm run monitor
# 또는
/bylane monitor
```

```
╔══════════════════════════════════════════════════════════════════╗
║  byLane Monitor   Issue #123: "Add dark mode"   4m 31s  17:32  ║
╠═══════════════════════════╦══════════════════════════════════════╣
║  AGENT PIPELINE           ║  AGENT LOG                 [LIVE]  ║
║                           ║                                     ║
║  issue-agent  [✓] 완료   ║  17:32:38 code-agent               ║
║  code-agent   [▶] 67%    ║    → ThemeToggle.tsx 생성           ║
║  test-agent   [○] 대기   ║  17:30:09 issue-agent              ║
║  ...                      ║    → ✓ spec.json 저장됨             ║
╠═══════════════════════════╬══════════════════════════════════════╣
║  QUEUE                    ║  SYSTEM STATUS                      ║
║  1  Issue #124  대기중    ║  GitHub    ✓ 연결됨                 ║
║  2  PR #45  review        ║  Slack     ✓ #dev-alerts            ║
╚═══════════════════════════╩══════════════════════════════════════╝
  [q]종료  [p]일시정지  [↑↓]로그스크롤
```

## 브랜치 네이밍 패턴

셋업 시 패턴을 정의하거나 `.bylane/bylane.json`에서 직접 설정:

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
```

각 에이전트는 수동 단독 실행 가능하며, 타인의 PR/리뷰에도 대응합니다.

## 개발

```bash
npm test        # 테스트 실행 (19개)
npm run monitor # 모니터 대시보드
```

## 라이선스

MIT
