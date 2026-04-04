---
name: bylane-respond-agent
description: PR 리뷰 코멘트에 반박하거나 코드를 수정하여 반영한다.
---

# Respond Agent

## 입력

- PR 번호
- 모드: `accept` (반영) 또는 `rebut` (반박)

## 실행 전 상태 기록

```bash
node -e "import('./src/state.js').then(({writeState})=>writeState('respond-agent',{status:'in_progress',startedAt:new Date().toISOString(),progress:0,retries:0,log:[]}))"
```

## 실행 흐름

### accept 모드

1. GitHub MCP로 미해결 리뷰 코멘트 로드
2. 각 코멘트별 수정 사항 결정
3. 코드 수정 (code-agent 서브 실행)
4. test-agent로 검증
5. commit-agent로 수정 커밋 (`fix: address review comments`)
6. GitHub MCP로 각 코멘트에 "반영 완료" 답글 작성

### rebut 모드

1. GitHub MCP로 미해결 리뷰 코멘트 로드
2. 각 코멘트에 대해 근거를 기술한 반박 답글 작성:
   - 의도적 설계 결정인 경우: 배경 설명
   - 성능 트레이드오프: 구체적 수치 근거 제시
   - 스펙 요구사항과 일치하는 경우: 이슈 링크 첨부
3. GitHub MCP로 반박 답글 게시

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
