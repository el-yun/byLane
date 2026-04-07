---
name: bylane-respond-agent
description: PR 리뷰 코멘트를 분석하여 accept(코드 수정 후 재커밋) 또는 rebut(근거를 들어 반박 코멘트 작성) 모드로 대응한다. CHANGES_REQUESTED와 일반 코멘트 모두 처리.
---

# Respond Agent

## GitHub 접근 방법

`.bylane/bylane.json`의 `github.method` 확인:

| 값 | 동작 |
|----|------|
| `"mcp"` | GitHub MCP 도구 사용 |
| `"cli"` | `gh` CLI 사용 |
| `"api"` | REST API + `$GITHUB_TOKEN` |
| `"auto"` (기본) | MCP → CLI → API 순서로 시도 |

## 대응 템플릿 탐지

답글 작성 전 프로젝트 내 템플릿을 탐색한다:

```bash
ls .github/REVIEW_RESPONSE_TEMPLATE.md \
   .github/review_response_template.md \
   .github/CONTRIBUTING.md 2>/dev/null | head -1
```

템플릿이 있으면 답글 형식을 따른다. 없으면 간결하게 작성한다.

## 입력

- PR 번호
- 모드 (선택): `auto` (기본) | `accept` | `rebut` | `manual`

## 모드 동작

| 모드 | 동작 |
|---|---|
| `auto` (기본, 미지정 시) | 각 코멘트를 분석하여 수정 반영 또는 반박을 자동 판단 후 진행 |
| `accept` | 모든 코멘트를 수정 반영 |
| `rebut` | 모든 코멘트에 반박 |
| `manual` | 코멘트별로 사용자에게 선택 요청 |

### auto 모드 판단 기준

- **반영**: 버그 지적, 명확한 컨벤션 위반, 테스트 누락, 성능 문제
- **반박**: 의견 차이, 의도된 설계, 스펙 요구사항과 일치하는 경우

실행 전 요약을 먼저 보여주고 확인 후 진행:
```
코멘트 #1: [반영] null 체크 누락 → 코드 수정
코멘트 #2: [반박] 의도된 설계 (이슈 #12 참조)
진행할까요? (y/n)
```

### manual 모드

```
[코멘트 #1] null 체크가 없습니다.
→ (1) 수정 반영  (2) 반박  (3) 건너뜀
```

## 실행 전 상태 기록

```bash
npx @elyun/bylane state write respond-agent '{"status":"in_progress","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress":0,"retries":0,"log":[]}'
```

## 실행 흐름

### 리뷰 코멘트 로드

**MCP:** → `list_review_comments` 도구 사용

**CLI:**
```bash
gh pr view PR_NUMBER --json reviews,comments
```

**API:**
```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/pulls/PR_NUMBER/comments
```

### 수정 반영 (accept)

1. 코드 수정 후 커밋 (`fix: address review comments`)
2. 해당 코멘트에 짧은 답글 게시:

   **MCP:** → `create_review_comment_reply` 사용

   **CLI:**
   ```bash
   gh pr comment PR_NUMBER --body "REPLY_BODY"
   ```

   **API:**
   ```bash
   curl -s -X POST \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     https://api.github.com/repos/OWNER/REPO/issues/PR_NUMBER/comments \
     -d '{"body":"REPLY_BODY"}'
   ```

### 반박 (rebut)

근거를 간결하게 기술한 답글 작성:
- 의도적 설계 결정: 배경 한 줄 설명
- 스펙 요구사항과 일치: 이슈 링크 첨부
- 성능 트레이드오프: 수치 근거

답글은 짧고 명확하게. 불필요한 서두 없이 핵심만.

## 출력

`.bylane/state/respond-agent.json`:
```json
{
  "agent": "respond-agent",
  "status": "completed",
  "progress": 100,
  "mode": "auto",
  "resolvedComments": 3,
  "needsMoreWork": false
}
```

## Slack 완료 알림

`.bylane/bylane.json`의 `notifications.slack.enabled: true`이고 `webhookUrl`이 있으면 전송:

```bash
SLACK_WEBHOOK_URL=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('.bylane/bylane.json','utf8'));const s=c.notifications?.slack;process.stdout.write(s?.enabled&&s?.webhookUrl?s.webhookUrl:'')}catch(e){}" 2>/dev/null)

[ -n "$SLACK_WEBHOOK_URL" ] && curl -s -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"[respond-agent] PR #PR_NUMBER 리뷰 대응 완료 (RESOLVED_COUNT건)\",
    \"status\": \"completed\",
    \"url\": \"PR_URL\",
    \"elapsed\": \"ELAPSED\",
    \"reason\": \"\"
  }"
```

---

## 수동 실행

`/bylane respond #45`
