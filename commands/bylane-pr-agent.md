---
name: bylane-pr-agent
description: 현재 브랜치의 전체 커밋 히스토리를 분석하여 GitHub Pull Request를 생성한다. 제목, 요약, 테스트 계획을 자동 작성하고 팀 모드 시 리뷰어를 할당한다.
---

# PR Agent

## GitHub 접근 방법

`.bylane/bylane.json`의 `github.method` 확인:

| 값 | 동작 |
|----|------|
| `"mcp"` | GitHub MCP 도구 사용 |
| `"cli"` | `gh` CLI 사용 |
| `"api"` | REST API + `$GITHUB_TOKEN` |
| `"auto"` (기본) | MCP → CLI → API 순서로 시도 |

## 입력

- `.bylane/state/commit-agent.json`의 `branchName`, `commitSha`
- `.bylane/state/issue-agent.json`의 `spec.title`, `issueNumber`

## GitHub PR 템플릿 탐지

PR 본문 작성 전 아래 순서로 템플릿을 탐색한다:

```bash
# 단일 파일
ls .github/PULL_REQUEST_TEMPLATE.md \
   .github/pull_request_template.md \
   docs/PULL_REQUEST_TEMPLATE.md \
   PULL_REQUEST_TEMPLATE.md 2>/dev/null | head -1

# 다중 템플릿 디렉토리
ls .github/PULL_REQUEST_TEMPLATE/*.md 2>/dev/null | head -5
```

템플릿이 있으면 해당 구조를 **반드시** 따른다.
다중 템플릿이 있으면 이슈 유형에 맞는 템플릿을 선택한다.
템플릿이 없으면 기본 Summary/Test Plan 형식을 사용한다.

## 실행 전 상태 기록

```bash
npx @elyun/bylane state write pr-agent '{"status":"in_progress","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress":0,"retries":0,"log":[]}'
```

## 실행 흐름

1. 원격 브랜치 푸시:
   ```bash
   git push -u origin BRANCH_NAME
   ```

2. PR 본문 생성:
   ```
   ## Summary
   - [변경 요약]

   ## Test Plan
   - [ ] 변경된 기능 동작 확인
   - [ ] 기존 테스트 통과 확인

   Closes #ISSUE_NUMBER
   ```

3. PR 생성:

   **MCP:**
   → GitHub MCP `create_pull_request` 도구 사용

   **CLI:**
   ```bash
   gh pr create \
     --title "TITLE" \
     --body "BODY" \
     --head BRANCH_NAME \
     --base main
   ```

   **API:**
   ```bash
   curl -s -X POST \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     https://api.github.com/repos/OWNER/REPO/pulls \
     -d '{"title":"TITLE","body":"BODY","head":"BRANCH_NAME","base":"main"}'
   ```

4. 상태 업데이트:
   ```bash
   npx @elyun/bylane state write pr-agent '{"status":"completed","progress":100,"prNumber":PR_NUMBER,"prUrl":"PR_URL"}'
   ```

## Slack 완료 알림

`.bylane/bylane.json`의 `notifications.slack.enabled: true`이고 `webhookUrl`이 있으면 전송:

```bash
SLACK_WEBHOOK_URL=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('.bylane/bylane.json','utf8'));const s=c.notifications?.slack;process.stdout.write(s?.enabled&&s?.webhookUrl?s.webhookUrl:'')}catch(e){}" 2>/dev/null)

[ -n "$SLACK_WEBHOOK_URL" ] && curl -s -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"[pr-agent] PR #PR_NUMBER 생성\",
    \"status\": \"completed\",
    \"url\": \"PR_URL\",
    \"elapsed\": \"ELAPSED\",
    \"reason\": \"\"
  }"
```

---

## 출력

`.bylane/state/pr-agent.json`:
```json
{
  "agent": "pr-agent",
  "status": "completed",
  "progress": 100,
  "prNumber": 45,
  "prUrl": "https://github.com/owner/repo/pull/45"
}
```

## 수동 실행

`/bylane pr`
