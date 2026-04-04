---
name: bylane-review-agent
description: PR의 diff를 분석하여 코드 리뷰 코멘트를 작성한다.
---

# Review Agent

## 입력

PR 번호 (`.bylane/state/pr-agent.json`에서 자동 로드, 또는 수동 전달)

## 실행 전 상태 기록

```bash
node -e "import('./src/state.js').then(({writeState})=>writeState('review-agent',{status:'in_progress',startedAt:new Date().toISOString(),progress:0,retries:0,log:[]}))"
```

## 실행 흐름

1. GitHub MCP로 PR diff 로드
2. 변경된 파일별 분석:
   - 버그 가능성 (null check, 경계값 등)
   - 타입 오류 (TypeScript)
   - 성능 이슈 (불필요한 리렌더링, 메모이제이션 누락)
   - 코딩 컨벤션 위반
   - 테스트 커버리지 누락

3. 리뷰 코멘트 심각도:
   - **CRITICAL**: 즉시 수정 필요 (버그, 보안)
   - **HIGH**: 수정 강력 권장
   - **MEDIUM**: 개선 권장
   - **LOW**: 선택적 개선

4. GitHub MCP로 리뷰 제출:
   - CRITICAL/HIGH 없으면 → `approve`
   - CRITICAL/HIGH 있으면 → `request_changes`

5. 상태 업데이트:
   ```bash
   node -e "
   import('./src/state.js').then(({writeState})=>writeState('review-agent',{
     status:'completed',
     progress:100,
     approved:APPROVED_BOOL,
     commentCount:COMMENT_COUNT
   }))
   "
   ```

## 출력

`.bylane/state/review-agent.json`:
```json
{
  "agent": "review-agent",
  "status": "completed",
  "progress": 100,
  "approved": true,
  "commentCount": 3
}
```

## 수동 실행

`/bylane review #45`
