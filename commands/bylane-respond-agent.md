---
name: bylane-respond-agent
description: PR 리뷰 코멘트에 반박하거나 코드를 수정하여 반영한다.
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

## GitHub 리뷰 대응 템플릿 탐지

답글 작성 전 프로젝트 내 대응 템플릿을 탐색한다:

```bash
ls .github/REVIEW_RESPONSE_TEMPLATE.md \
   .github/review_response_template.md \
   .github/CONTRIBUTING.md 2>/dev/null | head -1
```

- `REVIEW_RESPONSE_TEMPLATE.md`가 있으면 답글 형식을 **반드시** 따른다.
- `CONTRIBUTING.md`가 있으면 코드 기여 가이드라인을 참고하여 대응 톤/형식을 맞춘다.
- 없으면 기본 형식으로 작성한다.

## 입력

- PR 번호
- 모드: `accept` (반영) 또는 `rebut` (반박)

## 실행 전 상태 기록

```bash
node -e "import('./src/state.js').then(({writeState})=>writeState('respond-agent',{status:'in_progress',startedAt:new Date().toISOString(),progress:0,retries:0,log:[]}))"
```

## 실행 흐름

### 리뷰 코멘트 로드

**MCP:**
→ GitHub MCP `list_review_comments` 도구 사용

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

### accept 모드

1. 각 코멘트별 수정 사항 결정
2. 코드 수정 (code-agent 서브 실행)
3. test-agent로 검증
4. commit-agent로 수정 커밋 (`fix: address review comments`)
5. 코멘트에 "반영 완료" 답글 게시:

   **MCP:**
   → GitHub MCP `create_review_comment_reply` 도구 사용

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

### rebut 모드

1. 각 코멘트에 근거를 기술한 반박 답글 작성:
   - 의도적 설계 결정: 배경 설명
   - 성능 트레이드오프: 구체적 수치 근거
   - 스펙 요구사항과 일치하는 경우: 이슈 링크 첨부
2. 위와 동일한 방법으로 답글 게시

## 출력

`.bylane/state/respond-agent.json`:
```json
{
  "agent": "respond-agent",
  "status": "completed",
  "progress": 100,
  "mode": "accept",
  "resolvedComments": 3,
  "needsMoreWork": false
}
```

## 수동 실행

`/bylane respond #45` → accept/rebut 선택 프롬프트 표시
