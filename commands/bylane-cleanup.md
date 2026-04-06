---
name: bylane-cleanup
description: .bylane/state/ 파일 권한 수정(755/644), 죽은 루프 PID 정리, 30분 초과 in_progress→failed 전환, reviewing/responding→pending 큐 복구를 한 번에 실행한다.
---

# /bylane cleanup

## 중요

cleanup은 **터미널 명령**으로 실행하세요. Claude가 직접 실행하지 않고 명령을 안내합니다.

---

아래 명령을 실행하면 상태 정리가 완료됩니다:

```bash
npx @elyun/bylane cleanup
```

또는 모니터가 실행 중이라면 **`[r]` 키**를 누르면 즉시 실행됩니다.

---

## 정리 항목

| 항목 | 동작 |
|------|------|
| `.bylane/state/` 권한 | 디렉토리 755, 파일 644로 수정 |
| 죽은 루프 프로세스 | PID 확인 → 없으면 `stopped`로 전환 |
| 30분 초과 `in_progress` | `failed`로 초기화 |
| `subagents.json` active | PID 없는 항목 제거 |
| 큐의 `reviewing`/`responding` | `pending`으로 복구 (재처리 대기) |

## 완료

안내 후 이 스킬을 즉시 종료합니다.
