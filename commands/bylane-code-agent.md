---
name: bylane-code-agent
description: issue-agent가 작성한 전략 스펙을 기반으로 코드를 구현한다. 내부적으로 분석/구현/리뷰 서브에이전트를 활용하며, 서브에이전트 간 피드백 루프(Ralph Loop)로 품질을 보장한다. 부모 에이전트에게는 최종 결과만 반환한다.
---

# Code Agent

> **설계 원칙**: code-agent 본체는 **오케스트레이션만** 담당한다. 실제 파일 읽기/수정/분석은 전부 서브에이전트가 수행한다. 부모(orchestrator)에게는 `changedFiles` 결과만 돌려준다.

---

## 실행 전 상태 기록

```bash
npx @elyun/bylane state write code-agent '{"status":"in_progress","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress":0,"currentTask":"서브에이전트 초기화","retries":0,"log":[]}'
```

---

## 입력 읽기

`.bylane/state/issue-agent.json`에서 다음 필드를 읽는다:

| 필드 | 용도 |
|------|------|
| `spec.title` | 작업 제목 |
| `spec.approach` | 채택된 구현 방향 |
| `spec.affectedFiles` | 수정/추가할 파일 목록 |
| `spec.checklist` | 구현 체크리스트 |
| `spec.figmaSpec` | Figma 컬러토큰·컴포넌트 구조 |
| `issueType` | `new-feature` / `bug` / `improvement` / `chore` |
| `issueNumber` | GitHub 이슈 번호 |
| `branchName` | issue-agent가 생성한 브랜치명 |
| `worktreePath` | 워크트리 경로 (없으면 `null`) |

없으면 GitHub 이슈 본문을 직접 로드하여 파싱한다.

### 브랜치/워크트리 확인

issue-agent가 이미 브랜치를 생성했는지 확인한다:

1. `branchName`이 있으면 → 해당 브랜치로 checkout
2. `worktreePath`가 있으면 → 해당 워크트리 디렉토리에서 작업
3. 둘 다 없으면 (`issue.autoCreateBranch: false`) → code-agent가 직접 브랜치 생성

```bash
# branchName이 있는 경우
git checkout "$BRANCH_NAME"

# worktreePath가 있는 경우 — 해당 디렉토리에서 모든 작업 수행
cd "$WORKTREE_PATH"
```

issueMemory 로드:
```bash
npx @elyun/bylane memory read ISSUE_NUMBER
```

---

## Phase 1 — 병렬 분석 서브에이전트 (3개 동시 실행)

Agent 도구로 3개를 **동시에** 호출한다.
각 서브에이전트는 결과만 텍스트로 반환하고, code-agent 본체는 취합한다.

### 서브에이전트 A — 파일 현황 분석
```
prompt: |
  다음 파일들의 현재 구현 상태를 분석해줘:
  대상: {spec.affectedFiles}
  issueType: {issueType}

  각 파일에 대해:
  - 현재 구현 방식 요약 (있는 경우)
  - 변경이 필요한 라인/영역
  - 의존하는 import 목록

  결과만 간결하게 텍스트로 반환. 파일을 직접 수정하지 마라.
```

### 서브에이전트 B — 코드 패턴 샘플링
```
prompt: |
  이 프로젝트에서 유사한 구현 패턴을 찾아줘.
  구현할 기능: {spec.title}
  issueType: {issueType}

  찾아야 할 것:
  - 유사한 컴포넌트/함수 구현 예시 (파일경로:라인번호)
  - 사용 중인 네이밍 컨벤션
  - 테스트 파일 위치와 작성 패턴
  - 상태 관리 / API 호출 방식

  결과만 간결하게 텍스트로 반환. 파일을 수정하지 마라.
```

### 서브에이전트 C — 영향 범위 확인
```
prompt: |
  다음 파일들을 수정할 때 영향받는 코드를 파악해줘:
  대상: {spec.affectedFiles}

  찾아야 할 것:
  - 이 파일들을 import/사용하는 파일 목록
  - 공유 컴포넌트/훅인 경우 사이드 이펙트 위험도
  - bug/improvement인 경우: 현재 문제 지점 (파일:라인)

  결과만 간결하게 텍스트로 반환. 파일을 수정하지 마라.
```

---

## Phase 2 — Ralph Loop: 구현 → 리뷰 → 피드백 사이클

`spec.checklist` 항목을 순서대로 처리한다.
각 항목마다 **구현 서브에이전트 → 리뷰 서브에이전트** 쌍으로 실행하며,
리뷰가 통과될 때까지 피드백을 실어 구현 서브에이전트를 재호출한다.

```
for each checklistItem in spec.checklist:

  feedback = null
  retries = 0

  while true:
    [구현 서브에이전트 호출]
    [리뷰 서브에이전트 호출]

    if 리뷰 통과 → break
    if retries >= 2 → 상태에 경고 기록 후 break

    feedback = 리뷰 결과
    retries++
```

### 구현 서브에이전트 프롬프트

```
prompt: |
  다음 체크리스트 항목을 구현해줘.

  [컨텍스트]
  - 작업: {spec.title}
  - issueType: {issueType}
  - 구현 방향: {spec.approach}
  - 현재 항목: {checklistItem}
  - 관련 파일: {spec.affectedFiles에서 이 항목과 관련된 파일}

  [분석 결과]
  - 파일 현황: {서브에이전트 A 결과}
  - 참고 패턴: {서브에이전트 B 결과}
  - 영향 범위: {서브에이전트 C 결과}

  {feedback이 있으면 추가:}
  [이전 리뷰 피드백 — 이 내용을 반드시 반영해야 함]
  {feedback}

  [코딩 원칙]
  - 함수형 컴포넌트 + hooks 우선
  - 파일당 단일 책임
  - 200줄 초과 시 분리 고려
  - 불변성 패턴 유지 (객체 직접 수정 금지)
  - issueType이 bug라면 최소 변경으로 수정
  - issueType이 chore라면 기능 변경 없음 확인

  구현 완료 후 변경한 파일 목록만 반환해줘.
```

### 리뷰 서브에이전트 프롬프트

```
prompt: |
  방금 구현된 코드를 리뷰해줘.

  [검토 대상]
  - 항목: {checklistItem}
  - 변경 파일: {구현 서브에이전트가 반환한 파일 목록}

  [체크리스트]
  1. spec.approach 방향과 일치하는가?
  2. 코딩 원칙(불변성, 단일책임, 200줄) 준수했는가?
  3. issueType별 주의사항 지켰는가?
     - new-feature: 신규 파일 패턴이 기존 패턴과 일치하는가
     - bug: 최소 변경인가, 다른 동작 변경 없는가
     - improvement: 사이드 이펙트 없는가
     - chore: 기능 변경 없는가
  4. 명백한 버그나 누락 없는가?

  응답 형식:
  PASS — 문제 없음 (한 줄 요약)
  FAIL — {구체적인 문제점과 수정 방향}

  코드를 직접 수정하지 마라. 판정만 내려줘.
```

### 상태 로그 (각 항목 완료 시)

```bash
npx @elyun/bylane state append code-agent "{checklistItem} 구현 완료 (리뷰 통과)"
```

---

## Phase 3 — 완료 처리

모든 체크리스트 항목이 완료되면:

```bash
npx @elyun/bylane state write code-agent '{
  "status": "completed",
  "progress": 100,
  "currentTask": "구현 완료",
  "retries": 0,
  "changedFiles": CHANGED_FILES_ARRAY
}'
```

---

## issueMemory 기록

```bash
npx @elyun/bylane memory append ISSUE_NUMBER code-agent "구현 요약: SUMMARY
변경 파일: CHANGED_FILES
아키텍처 결정: DECISIONS
트러블슈팅: ISSUES_FACED"
```

`memory.enabled: false`이면 생략.

---

## 출력

부모(orchestrator)에게 돌려주는 값:
- `.bylane/state/code-agent.json`의 `changedFiles` 배열
- `status: "completed"` 또는 `"failed"`

## 수동 실행

`/bylane code #123`
