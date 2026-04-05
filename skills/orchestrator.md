---
name: bylane-orchestrator
description: byLane 메인 오케스트레이터. 자연어 의도를 파싱해 에이전트 파이프라인을 실행한다.
---

# byLane Orchestrator

## 역할

사용자의 자연어 입력을 파싱하여 어떤 에이전트를 어떤 순서로 실행할지 결정한다.

## 실행 전 체크

1. `.bylane/bylane.json` 로드. 없으면 즉시 `bylane-setup` 스킬 실행.
2. `.bylane/state/` 디렉토리 확인. 없으면 생성.

## 에이전트별 모델 결정

각 에이전트 실행 전 사용할 모델을 config에서 읽는다:

```bash
node -e "
import('./src/config.js').then(({loadConfig, getAgentModel}) => {
  const config = loadConfig()
  const agents = [
    'orchestrator','issue-agent','code-agent','test-agent',
    'commit-agent','pr-agent','review-agent','respond-agent','notify-agent'
  ]
  agents.forEach(a => console.log(a + ': ' + getAgentModel(config, a)))
  // analyze-agent는 항상 opus 사용 (config 무관)
})
"
```

에이전트 호출 시 해당 모델을 `model` 파라미터로 전달한다.

## 의도 파싱 규칙

입력을 분석하여 아래 중 하나로 분류:

| 패턴 | 실행할 에이전트 체인 |
|---|---|
| "구현", "만들어", "추가해", 이슈 없음 | issue-agent → code-agent → test-agent → commit-agent → pr-agent → review-agent → notify-agent |
| "issue #N 구현", "이슈 #N 작업" | issue-agent(분석) → code-agent → test-agent → commit-agent → pr-agent → review-agent → notify-agent |
| "PR #N 리뷰", "리뷰해줘" | review-agent(PR번호 전달) |
| "리뷰 #N 반영", "리뷰 수락" | respond-agent(PR번호, 모드=accept 전달) |
| "리뷰 #N 반박" | respond-agent(PR번호, 모드=rebut 전달) |
| "커밋해줘" | commit-agent |
| "PR 만들어줘" | pr-agent |
| "테스트해줘" | test-agent |
| "프로젝트 분석", "analyze", "코드스타일 분석", "디자인토큰 분석" | analyze-agent |

## 에이전트 실행 방법

각 에이전트를 순서대로 Agent 도구로 호출한다. 이전 에이전트의 출력을 다음 에이전트의 입력으로 전달한다.
**config에서 읽은 모델을 `model` 파라미터로 반드시 전달한다.**

상태 기록 (각 에이전트 시작 전):
```bash
node -e "
import('./src/state.js').then(({writeState}) => {
  writeState('AGENT_NAME', {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    progress: 0,
    currentTask: 'TASK_DESCRIPTION',
    retries: 0,
    log: []
  })
})
"
```

## 피드백 루프

test-agent가 FAIL을 반환하면:
1. `.bylane/state/test-agent.json`에서 `failureDetails` 읽기
2. `.bylane/state/orchestrator.json`에서 `retries` 값 읽기
3. `retries < config.workflow.maxRetries`이면 code-agent를 재실행 (실패 피드백 포함, retries+1)
4. `retries >= maxRetries`이면 notify-agent에 "개입 필요" 메시지 전송 후 중단

respond-agent가 "수정 필요"를 반환하면 동일 로직 적용.

## 완료 처리

모든 에이전트 완료 후:
1. 각 에이전트 state를 `status: "completed"`로 업데이트
2. notify-agent 실행하여 최종 결과 전송

## 수동 실행

`/bylane [자연어]` 또는 자연어 감지 시 자동 실행
