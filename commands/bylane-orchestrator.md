---
name: bylane-orchestrator
description: byLane 메인 오케스트레이터. 자연어 의도를 파싱하여 4가지 파이프라인(새 기능/기존 이슈/리뷰/단일 에이전트) 중 하나를 선택하고, 각 단계를 **서브에이전트**로 위임하여 실행한다. 오케스트레이터 본체는 상태 파일만 읽고 판단하며, 직접 구현하지 않는다.
---

# byLane Orchestrator

## 역할

사용자 의도를 파싱하고, 파이프라인을 결정한 뒤 **각 에이전트를 서브에이전트로 위임**한다.
오케스트레이터 자신은 **상태 조회와 다음 단계 결정**만 담당한다. 직접 코드를 수정하거나 이슈를 작성하지 않는다.

> **Hang 방지 원칙**: 오케스트레이터는 Agent 도구로 서브에이전트를 호출하고 결과만 받는다.
> 긴 작업(코드 구현, 분석, 테스트 등)을 직접 수행하면 Claude Code가 hang될 수 있다.

---

## 실행 전 체크

```bash
npx @elyun/bylane preflight
```
실패 시 안내 메시지 출력 후 **중단**. `.bylane/bylane.json` 없으면 즉시 `bylane-setup` 스킬 실행.

## 에이전트별 모델 결정

```bash
npx @elyun/bylane models
```
출력 형식: `AGENT_NAME=MODEL_ID`. 서브에이전트 호출 시 `model` 파라미터로 전달.

---

## 의도 파싱 규칙

### 파이프라인 A — 새 기능 / 이슈 없는 구현 요청

**감지 키워드**: `만들어`, `추가해`, `구현해`, `개발해`, `넣어줘`, `바꿔줘`, `변경해`, `개선해`, `수정해`,
`리팩터`, `리팩토링`, `마이그레이션`, `~해줘` (기능 설명 포함), 이슈 번호 없음

**실행 흐름**: `issue-agent` → `code-agent` → `test-agent` → `commit-agent` → `pr-agent` → `review-agent` → `notify-agent`

### 파이프라인 B — 기존 이슈 구현

**감지 키워드**: `#N`, `이슈 #N`, `issue #N`, `#N 구현`, `#N 작업`, `#N 해줘`, `#N 처리`

**실행 흐름**: `code-agent` → `test-agent` → `commit-agent` → `pr-agent` → `review-agent` → `notify-agent`

### 파이프라인 C — 리뷰 관련

| 감지 키워드 | 실행 |
|---|---|
| `PR #N 리뷰`, `리뷰해줘`, `코드 리뷰`, `#N 봐줘` | `review-agent`(PR번호 전달) |
| `리뷰 반영`, `수락`, `accept`, `LGTM 반영`, `코멘트 반영` | `respond-agent`(모드=accept) |
| `반박`, `rebut`, `동의 안 해`, `이유 설명` | `respond-agent`(모드=rebut) |

### 파이프라인 D — 단일 에이전트

| 감지 키워드 | 실행 |
|---|---|
| `커밋`, `commit` | `commit-agent` |
| `PR`, `풀리퀘`, `PR 만들어` | `pr-agent` |
| `테스트`, `test`, `검증` | `test-agent` |
| `분석`, `구조 파악` | `analyze-agent` |
| `알림`, `notify` | `notify-agent` |

### 판단 기준

1. 이슈 번호(`#N`) → 파이프라인 B
2. 기능/변경 키워드 + 이슈 번호 없음 → 파이프라인 A
3. 리뷰/대응 키워드 → 파이프라인 C
4. 단일 에이전트 키워드만 → 파이프라인 D
5. 판단 불가 → 사용자에게 의도 확인

---

## 파이프라인 실행 방식 (핵심)

오케스트레이터는 각 에이전트를 **Agent 도구로 서브에이전트 호출**한다.
서브에이전트가 완료되면 `.bylane/state/{name}.json`의 `status`만 확인하고 다음 단계로 진행한다.

```
[오케스트레이터]
    ↓ Agent 도구 호출 (bylane-issue-agent 스킬)
[issue-agent 서브에이전트] — 내부에서 3개 병렬 분석 서브에이전트 실행
    ↓ 완료 → .bylane/state/issue-agent.json 에 결과 기록
[오케스트레이터] state 확인 → issueNumber, spec 읽기
    ↓ Agent 도구 호출 (bylane-code-agent 스킬)
[code-agent 서브에이전트] — 내부에서 구현/리뷰 피드백 루프 실행
    ↓ 완료 → .bylane/state/code-agent.json 에 결과 기록
[오케스트레이터] state 확인 → changedFiles 읽기
    ↓ ... (이하 동일)
```

### 각 에이전트 호출 방법

Agent 도구에 아래 형식으로 전달한다:

```
subagent_type: "general-purpose"
model: {models 명령으로 확인한 해당 에이전트 모델}
prompt: |
  다음 bylane 스킬을 실행해줘: bylane-{에이전트명}

  [컨텍스트]
  - 이슈 번호: {issueNumber} (있는 경우)
  - 이슈 URL: {issueUrl} (있는 경우)
  - 이전 단계 출력: {이전 state 파일 핵심 필드}

  스킬 완료 후 .bylane/state/{에이전트명}.json 에 결과가 기록된다.
  결과 파일의 status, 핵심 출력 필드만 응답으로 돌려줘.
```

---

## 피드백 루프 (오케스트레이터 레벨)

test-agent가 FAIL 반환 시:

1. `.bylane/state/test-agent.json`에서 `failureDetails` 읽기
2. `retries < config.workflow.maxRetries` → **code-agent 서브에이전트 재호출** (failureDetails 포함, retries+1)
3. `retries >= maxRetries` → notify-agent에 "개입 필요" 메시지 후 중단

respond-agent가 "수정 필요" 반환 시 동일 로직.

> 재호출 시 code-agent에 전달할 추가 컨텍스트:
> `"이전 테스트 실패 내용: {failureDetails}. 해당 부분을 중점적으로 수정해줘."`

---

## 완료 처리

각 에이전트 완료 후 notify-agent 서브에이전트 호출:

```
prompt: |
  bylane-notify-agent 스킬 실행.
  type: completed
  summary: {전체 파이프라인 요약}
  url: {PR URL}
```

## 수동 실행

`/bylane [자연어]` 또는 자연어 감지 시 자동 실행
