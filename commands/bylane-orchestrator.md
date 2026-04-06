---
name: bylane-orchestrator
description: byLane 메인 오케스트레이터. 전략 수립 후 에이전트 파이프라인을 실행한다.
---

# byLane Orchestrator

## 역할

사용자 의도를 파싱하고, issue-agent를 통해 전략을 수립한 뒤 에이전트 파이프라인을 실행한다.

## 실행 전 체크

1. 사전 점검:
   ```bash
   npx @elyun/bylane preflight
   ```
   실패 시 안내 메시지 출력 후 **중단**. `.bylane/bylane.json` 없으면 즉시 `bylane-setup` 스킬 실행.

2. `.bylane/state/` 디렉토리 확인. 없으면 생성.

## 에이전트별 모델 결정

```bash
npx @elyun/bylane models
```

출력 형식: `AGENT_NAME=MODEL_ID` (한 줄씩). 에이전트 호출 시 `model` 파라미터로 전달.

## 의도 파싱 규칙

| 패턴 | 실행 흐름 |
|---|---|
| "구현", "만들어", "추가해", 이슈 없음 | **전략 수립** → issue-agent → code-agent → test-agent → commit-agent → pr-agent → review-agent → notify-agent |
| "issue #N 구현", "이슈 #N 작업" | **전략 수립(기존 이슈 분석)** → code-agent → test-agent → commit-agent → pr-agent → review-agent → notify-agent |
| "PR #N 리뷰", "리뷰해줘" | review-agent(PR번호 전달) |
| "리뷰 #N 반영", "리뷰 수락" | respond-agent(PR번호, 모드=accept) |
| "리뷰 #N 반박" | respond-agent(PR번호, 모드=rebut) |
| "커밋해줘" | commit-agent |
| "PR 만들어줘" | pr-agent |
| "테스트해줘" | test-agent |
| "프로젝트 분석", "analyze" | analyze-agent |

## 전략 수립 단계 (새 기능 / 이슈 구현 시 필수)

`리뷰`, `커밋`, `PR`, `테스트` 단독 요청이 아닌 경우 반드시 전략 수립 후 진행.

issue-agent를 `model` 파라미터와 함께 호출한다. issue-agent 내부에서 다음을 수행:

1. 코드베이스 병렬 분석 (서브에이전트)
2. 사용자 문답
3. 이슈 분류 및 작성

상세 로직은 `bylane-issue-agent` 참조.

## 에이전트 실행 방법

각 에이전트를 순서대로 Agent 도구로 호출. 이전 출력을 다음 입력으로 전달.
**config에서 읽은 모델을 `model` 파라미터로 반드시 전달.**

상태 기록 (각 에이전트 시작 전):
```bash
npx @elyun/bylane state write AGENT_NAME '{"status":"in_progress","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress":0,"currentTask":"TASK_DESCRIPTION","retries":0,"log":[]}'
```

## 피드백 루프

test-agent가 FAIL 반환 시:
1. `.bylane/state/test-agent.json`에서 `failureDetails` 읽기
2. `retries < config.workflow.maxRetries` → code-agent 재실행 (실패 피드백 포함, retries+1)
3. `retries >= maxRetries` → notify-agent에 "개입 필요" 메시지 후 중단

respond-agent가 "수정 필요" 반환 시 동일 로직 적용.

## 완료 처리

1. 각 에이전트 state를 `status: "completed"`로 업데이트
2. notify-agent 실행하여 최종 결과 전송

## 수동 실행

`/bylane [자연어]` 또는 자연어 감지 시 자동 실행
