---
name: bylane-issue-agent
description: GitHub Issue 생성 및 분석. Figma 링크 감지 시 스펙 추출.
---

# Issue Agent

## GitHub 접근 방법

`.bylane/bylane.json`의 `github.method` 확인:

| 값 | 동작 |
|----|------|
| `"mcp"` | GitHub MCP 도구 사용 |
| `"cli"` | `gh` CLI 사용 |
| `"api"` | REST API + `$GITHUB_TOKEN` |
| `"auto"` (기본) | MCP → CLI → API 순서로 시도 |

## 입력

- 자유 텍스트 (새 이슈 생성용) OR GitHub Issue 번호 (#N)

## 실행 흐름

### 새 이슈 생성 모드 (텍스트 입력)

1. 입력 텍스트에서 추출:
   - 제목 (50자 이내), 상세 설명, 구현 체크리스트, Figma URL

2. 이슈 생성:

   **MCP:**
   → GitHub MCP `create_issue` 도구 사용

   **CLI:**
   ```bash
   gh issue create \
     --title "TITLE" \
     --body "BODY" \
     --label "bylane-auto"
   ```

   **API:**
   ```bash
   curl -s -X POST \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     https://api.github.com/repos/OWNER/REPO/issues \
     -d '{"title":"TITLE","body":"BODY","labels":["bylane-auto"]}'
   ```

3. Figma MCP 활성화 여부 확인 (`extensions.figma.enabled`):
   - `true`이고 Figma URL 있으면 → Figma 분석 단계 실행
   - `false` → 텍스트 기반 스펙만 생성

### 기존 이슈 분석 모드 (Issue 번호 입력)

1. 이슈 내용 로드:

   **MCP:**
   → GitHub MCP `get_issue` 도구 사용

   **CLI:**
   ```bash
   gh issue view NUMBER --json title,body,labels
   ```

   **API:**
   ```bash
   curl -s \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     https://api.github.com/repos/OWNER/REPO/issues/NUMBER
   ```

2. 본문에서 Figma URL 추출 시도 후 스펙 생성

### Figma 분석 (활성화된 경우)

Figma MCP `get_file` 또는 `get_node` 도구로 프레임/컴포넌트 분석.

**실패 시 fallback:** 경고 로그 후 텍스트 기반 스펙 사용

## 출력

`.bylane/state/issue-agent.json`:

```json
{
  "agent": "issue-agent",
  "status": "completed",
  "progress": 100,
  "issueNumber": 123,
  "issueUrl": "https://github.com/...",
  "spec": {
    "title": "다크모드 토글 버튼 추가",
    "description": "...",
    "checklist": ["ThemeToggle 컴포넌트 생성", "useTheme hook 구현"],
    "figmaSpec": { "enabled": false, "components": [], "colorTokens": {} }
  }
}
```

상태 기록:
```bash
npx @elyun/bylane state write issue-agent '{"status":"in_progress","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress":0,"retries":0}'
```

## 수동 실행

`/bylane issue #123` 또는 `/bylane issue 다크모드 토글 추가해줘`
