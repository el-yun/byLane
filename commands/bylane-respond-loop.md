---
name: bylane-respond-loop
description: 백그라운드 폴러가 설정 주기(기본 5분)로 내 PR에 달린 CHANGES_REQUESTED/코멘트를 감지하여 respond-queue에 기록한다. pending 항목 발생 시 respond-agent를 자동 실행하며, 대응 후 새 코멘트 감지 시 재처리한다.
---

# Respond Loop Agent

## 개요

백그라운드 폴러(`src/respond-loop.js`)가 5분마다 내 PR에 달린 리뷰/코멘트를 감지하여
`.bylane/state/respond-queue.json`에 기록한다. 이 skill은 해당 큐를 감시하다가
`status: "pending"` 항목이 생기면 `bylane-respond-agent`를 실행한다.

감지 대상:
- `CHANGES_REQUESTED` 리뷰
- 일반 코멘트 (COMMENTED)
- 대응 후 추가된 새 코멘트 (updatedAt 변경 감지)

## 시작

### 1. 폴러 시작 (백그라운드)

```bash
node src/respond-loop.js &
echo "폴러 PID: $!"
```

### 2. 큐 감시 루프

pending PR이 생길 때마다 respond-agent를 실행한다:

```bash
# 큐 확인 (pending 항목 필터링)
npx @elyun/bylane state read respond-queue
```

출력된 JSON에서 `queue` 배열의 `status === "pending"` 항목을 선택한다.

pending 항목이 있으면 각 PR에 대해:

1. `hasChangesRequested` 여부 확인:
   - `true` → 사용자에게 `accept` / `rebut` 모드 선택 요청 후 `bylane-respond-agent` 실행
   - `false` (코멘트만) → 코멘트 내용 확인 후 `accept` / `rebut` 모드 자동 판단 또는 사용자에게 선택 요청

2. `bylane-respond-agent` skill 실행 (PR 번호 + 모드 전달)

3. 완료 후 큐 항목을 `status: "responded"`로 업데이트:

```bash
# 현재 큐 읽기 후 PR_NUMBER 항목을 responded로 업데이트하여 다시 쓰기
npx @elyun/bylane state write respond-queue '{"status":"running","queue":UPDATED_QUEUE_JSON}'
```

4. 다음 pending 항목으로 반복. pending 없으면 5분 대기 후 재확인 (폴러 주기와 동일).

## 큐 항목 스키마

`.bylane/state/respond-queue.json`:

```json
{
  "agent": "respond-queue",
  "status": "running",
  "queue": [
    {
      "number": 45,
      "title": "Add dark mode toggle",
      "url": "https://github.com/owner/repo/pull/45",
      "branch": "feature/45-dark-mode",
      "updatedAt": "2026-04-05T10:00:00Z",
      "hasChangesRequested": true,
      "status": "pending",
      "detectedAt": "2026-04-05T10:01:00Z"
    }
  ]
}
```

`status` 값:
- `pending` — 대응 대기 중
- `responding` — 현재 respond-agent 실행 중
- `responded` — 대응 완료 (새 코멘트 오면 pending으로 재전환)

## 재감지

폴러가 이미 `responded` 상태인 PR의 `updatedAt`이 변경된 것을 감지하면
자동으로 `status: "pending"`으로 되돌린다.

## 종료

```bash
kill $(pgrep -f respond-loop.js)
```

## 수동 실행

`/bylane-respond-loop`
