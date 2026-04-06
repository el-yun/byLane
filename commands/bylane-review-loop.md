---
name: bylane-review-loop
description: 백그라운드 폴러가 설정 주기(기본 5분)로 GitHub review 요청 PR을 감지하여 review-queue에 기록한다. pending 항목 발생 시 review-agent를 자동 실행하며, 리뷰 후 updatedAt 변경 시 재요청도 처리한다.
---

# Review Loop Agent

## 개요

백그라운드 폴러(`src/review-loop.js`)가 5분마다 GitHub을 체크하여 review 요청된 PR을
`.bylane/state/review-queue.json`에 기록한다. 이 skill은 해당 큐를 감시하다가
`status: "pending"` 항목이 생기면 `bylane-review-agent`를 실행한다.

## 검사 범위 설정

루프 시작 전 사용자에게 검사 범위를 묻는다:

```
자동 리뷰 검사 항목을 선택하세요 (쉼표 구분, Enter=전체):
  1. grammar  — 문법, 오탈자, 주석/변수명 언어 일관성
  2. domain   — 비즈니스 로직, 도메인 규칙 준수 여부
  3. code     — 코드 스타일, 컨벤션, 중복, 복잡도
  4. security — 보안 취약점, 시크릿 노출, 인증/인가 이슈

선택 (예: 1,3 또는 Enter=전체):
```

선택된 범위를 `.bylane/state/review-queue.json`의 `scope` 필드에 저장하고,
이후 각 `bylane-review-agent` 호출 시 해당 scope를 전달한다.

## 시작

### 1. 폴러 시작 (백그라운드)

```bash
node src/review-loop.js &
echo "폴러 PID: $!"
```

또는 별도 터미널에서:
```bash
node src/review-loop.js
```

### 2. 큐 감시 루프

아래 루프를 실행하면서 pending PR이 생길 때마다 review-agent를 실행한다:

```bash
# 큐 확인 (pending 항목 필터링)
npx @elyun/bylane state read review-queue
```

출력된 JSON에서 `queue` 배열의 `status === "pending"` 항목을 선택한다.

pending 항목이 있으면 각 PR에 대해:
1. `bylane-review-agent` skill 실행 (PR 번호 전달)
2. 리뷰 완료 후 큐 항목을 `status: "reviewed"`로 업데이트:

```bash
# 현재 큐 읽기 후 PR_NUMBER 항목을 reviewed로 업데이트하여 다시 쓰기
npx @elyun/bylane state write review-queue '{"status":"running","queue":UPDATED_QUEUE_JSON}'
```

3. 다음 pending 항목으로 반복
4. pending 없으면 5분 대기 후 재확인 (폴러 주기와 동일)

## 큐 항목 스키마

`.bylane/state/review-queue.json`:

```json
{
  "agent": "review-queue",
  "status": "running",
  "scope": ["code", "security"],
  "queue": [
    {
      "number": 45,
      "title": "Add dark mode toggle",
      "url": "https://github.com/owner/repo/pull/45",
      "branch": "feature/45-dark-mode",
      "updatedAt": "2026-04-05T10:00:00Z",
      "status": "pending",
      "detectedAt": "2026-04-05T10:01:00Z"
    }
  ]
}
```

`status` 값:
- `pending` — 리뷰 대기 중
- `reviewing` — 현재 review-agent 실행 중
- `reviewed` — 리뷰 완료 (updatedAt 변경 시 pending으로 재전환됨)

## 재요청 처리

폴러가 이미 `reviewed` 상태인 PR의 `updatedAt`이 변경된 것을 감지하면
자동으로 `status: "pending"`으로 되돌린다.

## 종료

```bash
# 폴러 종료
kill $(pgrep -f review-loop.js)

# 또는 폴러 터미널에서 Ctrl+C
```

## 수동 실행

`/bylane-review-loop`
