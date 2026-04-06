---
name: bylane-monitor
description: byLane 실시간 TUI 모니터 대시보드 실행 안내. Claude가 직접 실행하지 않고 사용자 터미널 명령을 안내한다.
---

# /bylane monitor

## 중요

모니터는 **long-running 터미널 프로세스**입니다.
Claude가 직접 실행하지 않는다. 사용자에게 아래 명령을 안내하고 즉시 완료한다.

## 안내 메시지 출력

다음을 그대로 사용자에게 출력하고 이 스킬을 종료한다:

---

모니터 대시보드는 터미널에서 직접 실행하세요:

```bash
npx @elyun/bylane monitor
```

> `npx`를 사용하면 항상 최신 버전 모니터가 실행됩니다.
> 로컬 node_modules의 구버전이 실행되지 않습니다.

**종료**: `q` 또는 `Ctrl+C`

---

## 완료

안내 메시지 출력 후 이 스킬은 완료됩니다. 추가 작업 없음.
