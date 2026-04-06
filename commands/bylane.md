---
name: bylane
description: byLane 메인 커맨드. 자연어로 전체 개발 워크플로우를 실행한다.
---

# /bylane

## 사용법

```
/bylane [자연어 명령]   — 전체 워크플로우 자동 실행
/bylane setup          — 셋업 위자드 (재실행 가능)
/bylane analyze        — 프로젝트 분석 후 .claude/instructions/ 에 instruction 파일 생성
/bylane monitor        — 실시간 TUI 대시보드
/bylane issue [#번호 | 텍스트]
/bylane code [#번호]
/bylane test
/bylane commit
/bylane pr
/bylane review [PR번호]
/bylane review-loop    — 5분 주기 자동 리뷰 루프 시작
/bylane respond [PR번호]
/bylane respond-loop    — 5분 주기 자동 대응 루프 시작
/bylane notify
/bylane status         — 현재 상태 한 줄 요약
```

## 사전 점검 (모든 명령 전 자동 실행)

서브커맨드를 라우팅하기 전 아래 점검을 실행한다:

```bash
npx @elyun/bylane preflight
```

점검 항목:
- `.bylane/bylane.json` 존재 여부 → 없으면 `/bylane setup` 안내 후 중단
- GitHub 접근 방법 (`github.method` 기준):
  - `cli`: `gh auth status` → 로그인 안 됐으면 `gh auth login` 안내
  - `api`: `GITHUB_TOKEN` 환경변수 → 없으면 설정 방법 안내
  - `auto`/`mcp`: CLI + Token 둘 다 확인, 어느 것도 없으면 안내
- 알림 채널 (활성화된 경우만): Slack 채널 설정 여부, Telegram 토큰 여부

문제가 있으면 각 항목마다 수정 방법을 출력하고 중단한다.
`setup`, `status`, `preflight` 서브커맨드는 점검 없이 바로 실행한다.

## 실행 흐름

첫 번째 인자가 서브커맨드인지 확인.
**반드시 아래 표의 "실행 스킬" 전체 이름을 Skill 도구에 전달한다. 서브커맨드 이름(analyze, setup 등)을 그대로 스킬 이름으로 사용하지 않는다.**

| 서브커맨드 | 실행 스킬 |
|---|---|
| (없음 or 자연어) | `bylane-orchestrator` |
| `setup` | `bylane-setup` |
| `monitor` | 아래 참조 |
| `issue` | `bylane-issue-agent` |
| `code` | `bylane-code-agent` |
| `test` | `bylane-test-agent` |
| `commit` | `bylane-commit-agent` |
| `pr` | `bylane-pr-agent` |
| `review` | `bylane-review-agent` |
| `analyze` | `bylane-analyze-agent` |
| `review-loop` | `bylane-review-loop` |
| `respond` | `bylane-respond-agent` |
| `respond-loop` | `bylane-respond-loop` |
| `notify` | `bylane-notify-agent` |
| `status` | `.bylane/state/` 파일 읽어 한 줄 요약 출력 |
| `preflight` | 연동 상태 점검 및 문제 안내 |

## monitor 서브커맨드

```bash
npm run monitor --prefix PATH_TO_BYLANE
```

또는 byLane이 PATH에 설치된 경우:
```bash
bylane-monitor
```

## status 서브커맨드

`.bylane/state/*.json` 파일을 읽어 각 에이전트의 현재 상태를 한 줄로 출력:

```
orchestrator: idle | issue-agent: completed | code-agent: in_progress(67%) | ...
```
