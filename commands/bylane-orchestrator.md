---
name: bylane-orchestrator
description: byLane 메인 오케스트레이터. 자연어 의도를 파싱하여 4가지 파이프라인(새 기능/기존 이슈/리뷰/단일 에이전트) 중 하나를 선택하고 에이전트 체인을 순차 실행한다.
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

오케스트레이터는 `/bylane`에서 **복합 의도** 또는 **기능 요청 자연어**가 넘어올 때 실행된다.
단일 에이전트 키워드는 `/bylane`이 직접 라우팅하므로, 오케스트레이터는 **파이프라인 실행**에 집중한다.

### 파이프라인 A — 새 기능 / 이슈 없는 구현 요청

**감지 키워드**: `만들어`, `추가해`, `구현해`, `개발해`, `넣어줘`, `바꿔줘`, `변경해`, `개선해`, `수정해`,
`리팩터`, `리팩토링`, `마이그레이션`, `~해줘` (기능 설명 포함), 이슈 번호 없음

**실행 흐름**:
전략 수립 → `issue-agent` → `code-agent` → `test-agent` → `commit-agent` → `pr-agent` → `review-agent` → `notify-agent`

### 파이프라인 B — 기존 이슈 구현

**감지 키워드**: `#N`, `이슈 #N`, `issue #N`, `#N 구현`, `#N 작업`, `#N 해줘`, `#N 처리`

**실행 흐름**:
전략 수립(기존 이슈 분석) → `code-agent` → `test-agent` → `commit-agent` → `pr-agent` → `review-agent` → `notify-agent`

### 파이프라인 C — 리뷰 관련

| 감지 키워드 | 실행 |
|---|---|
| `PR #N 리뷰`, `리뷰해줘`, `코드 리뷰`, `#N 봐줘` | `review-agent`(PR번호 전달) |
| `리뷰 반영`, `수락`, `accept`, `LGTM 반영`, `코멘트 반영` | `respond-agent`(모드=accept) |
| `반박`, `rebut`, `동의 안 해`, `이유 설명`, `왜 이렇게 했냐면` | `respond-agent`(모드=rebut) |

### 파이프라인 D — 단일 에이전트 (오케스트레이터 경유 시)

| 감지 키워드 | 실행 |
|---|---|
| `커밋`, `commit`, `커밋해줘`, `변경사항 저장` | `commit-agent` |
| `PR`, `풀리퀘`, `PR 만들어`, `PR 올려` | `pr-agent` |
| `테스트`, `test`, `검증`, `시험`, `테스트 돌려` | `test-agent` |
| `분석`, `analyze`, `구조 파악`, `코드 분석` | `analyze-agent` |
| `알림`, `notify`, `슬랙`, `텔레그램`, `통보` | `notify-agent` |

### 파이프라인 판단 기준

1. 이슈 번호(`#N`)가 있으면 → **파이프라인 B**
2. 기능/변경 요청 키워드가 있고 이슈 번호 없으면 → **파이프라인 A**
3. 리뷰/대응 키워드가 있으면 → **파이프라인 C**
4. 단일 에이전트 키워드만 있으면 → **파이프라인 D**
5. 복합 키워드 ("이슈 만들고 구현까지", "테스트하고 커밋") → 파이프라인 A 또는 해당 에이전트 순차 실행
6. 판단 불가 → 사용자에게 의도 확인

## 전략 수립 단계 (파이프라인 A, B 필수)

파이프라인 C, D (단일 에이전트 요청)가 아닌 경우 반드시 전략 수립 후 진행.

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
