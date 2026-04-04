---
name: bylane-post-tool-use
description: GitHub 이벤트 감지 후 적절한 byLane 에이전트를 자동 트리거한다.
trigger: post-tool-use
---

# byLane External Event Hook

GitHub MCP 도구 사용 후 결과를 분석하여 자동으로 에이전트를 트리거한다.

## 비활성화 조건

`.bylane/bylane.json`에 `"hookAutoTrigger": false`가 있으면 이 hook을 실행하지 않는다.

## 감지 규칙

### PR 오픈 감지

GitHub MCP 도구 결과에서 다음 조건이 모두 충족될 때:
- `state: "open"`인 PR 존재
- `user.login`이 `.bylane/bylane.json`의 `team.members` 중 하나
- `team.enabled: true`

→ `bylane-review-agent` 스킬 실행 (PR 번호 전달)

### 리뷰 코멘트 수신 감지

GitHub MCP 결과에서 다음 조건이 충족될 때:
- 내 PR에 `review_state: "changes_requested"` 발견

→ `bylane-respond-agent` 스킬 실행 (PR 번호 전달)

### CI 실패 감지

GitHub MCP `get_pull_request_status` 결과에서:
- `state: "failure"` 발견

→ `.bylane/state/code-agent.json`의 `retries` 확인
→ `retries < config.workflow.maxRetries`이면 `bylane-code-agent` 재실행
→ 초과 시 `bylane-notify-agent`로 에스컬레이션
