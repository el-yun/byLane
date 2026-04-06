---
name: bylane-test-agent
description: 변경된 코드의 테스트를 실행하고 결과를 반환한다.
---

# Test Agent

## 입력

`.bylane/state/code-agent.json`의 `changedFiles` 배열

## 실행 전 상태 기록

```bash
npx @elyun/bylane state write test-agent '{"status":"in_progress","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress":0,"retries":0,"log":[]}'
```

## 실행 흐름

1. `.bylane/state/code-agent.json`에서 `changedFiles` 로드
2. 관련 테스트 파일 탐지 (`*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.test.js`)
3. 프로젝트 테스트 커맨드 확인 (`package.json` → `scripts.test`)
4. 테스트 실행:
   ```bash
   npm test 2>&1
   ```
5. 결과 파싱:
   - 모두 통과 → `status: "passed"` 저장
   - 실패 있음 → `status: "failed"`, `failureDetails` 포함 저장

## 출력

`.bylane/state/test-agent.json`:
```json
{
  "agent": "test-agent",
  "status": "passed",
  "progress": 100,
  "totalTests": 12,
  "passed": 12,
  "failed": 0,
  "failureDetails": []
}
```

실패 시:
```json
{
  "agent": "test-agent",
  "status": "failed",
  "progress": 100,
  "totalTests": 12,
  "passed": 10,
  "failed": 2,
  "failureDetails": [
    { "test": "should render ThemeToggle", "error": "Cannot read property of undefined" }
  ]
}
```

## 수동 실행

`/bylane test`
