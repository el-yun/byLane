---
name: bylane-notify-agent
description: 워크플로우 완료, 테스트 실패, 리뷰 대기, 개입 필요 등 주요 이벤트 발생 시 설정된 채널(Slack/Telegram)로 알림을 보낸다. bylane.json의 notifications 설정을 따른다.
---

# Notify Agent

## 입력

- `type`: `completed` | `escalated` | `error`
- `summary`: 결과 요약 텍스트
- `url`: 관련 GitHub URL (PR, Issue 등)

## 실행 전 상태 기록

```bash
npx @elyun/bylane state write notify-agent '{"status":"in_progress","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress":0,"retries":0,"log":[]}'
```

## 실행 흐름

`.bylane/bylane.json`에서 알림 설정 로드.

### 터미널 출력 (항상 실행)

```
[byLane] ✅ 완료: TITLE
PR: PR_URL
소요 시간: ELAPSED
```

에러/에스컬레이션 시:
```
[byLane] ⚠️ 개입 필요: TITLE
이유: REASON
확인: PR_URL
```

### Slack 알림 (notifications.slack.enabled: true)

Slack Workflow Builder 웹훅으로 POST한다.
Workflow에 정의된 변수 스키마와 페이로드 키가 일치해야 한다.

```bash
# 완료 (type: completed)
curl -s -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"TITLE\",
    \"status\": \"completed\",
    \"url\": \"PR_URL\",
    \"elapsed\": \"ELAPSED\",
    \"reason\": \"\"
  }"

# 개입 필요 (type: escalated / error)
curl -s -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"TITLE\",
    \"status\": \"escalated\",
    \"url\": \"PR_URL\",
    \"elapsed\": \"\",
    \"reason\": \"REASON\"
  }"
```

Workflow Builder에서 정의해야 할 변수 스키마:

| 변수명 | 타입 | 설명 |
|--------|------|------|
| `title` | 텍스트 | 작업 제목 |
| `status` | 텍스트 | `completed` / `escalated` / `error` |
| `url` | 텍스트 | GitHub PR/Issue URL |
| `elapsed` | 텍스트 | 소요 시간 (완료 시) |
| `reason` | 텍스트 | 실패/에스컬레이션 이유 |

`webhookUrl`이 비어 있으면 Slack 알림을 건너뛴다.

### Telegram 알림 (notifications.telegram.enabled: true)

```bash
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$TELEGRAM_CHAT_ID&text=MESSAGE&parse_mode=Markdown"
```

## 출력

`.bylane/state/notify-agent.json`:
```json
{
  "agent": "notify-agent",
  "status": "completed",
  "progress": 100,
  "notifiedChannels": ["terminal", "slack"]
}
```

## 수동 실행

`/bylane notify` → 가장 최근 워크플로우 결과로 알림 발송
