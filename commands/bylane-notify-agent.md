---
name: bylane-notify-agent
description: 워크플로우 완료 또는 개입 필요 시 Slack/Telegram으로 알림을 보낸다.
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

Slack MCP `slack_send_message` 도구 사용:
- 채널: `config.notifications.slack.channel`
- 완료 메시지:
  ```
  [byLane] ✅ 완료: TITLE
  PR: PR_URL | 소요 시간: ELAPSED
  ```
- 개입 필요 메시지:
  ```
  [byLane] ⚠️ 개입 필요: TITLE
  이유: REASON | 확인: PR_URL
  ```

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
