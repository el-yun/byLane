---
name: bylane-code-agent
description: issue-agent의 스펙을 기반으로 프론트엔드 코드를 구현한다.
---

# Code Agent

## 입력

`.bylane/state/issue-agent.json`에서 `spec` 읽기. 없으면 사용자에게 스펙 텍스트 직접 입력 요청.

## 실행 전 상태 기록

```bash
npx @elyun/bylane state write code-agent '{"status":"in_progress","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress":0,"currentTask":"코드 구현 시작","retries":0,"log":[]}'
```

## 실행 흐름

1. `.bylane/state/issue-agent.json` 로드하여 `spec` 추출
2. `spec.checklist` 항목을 순서대로 구현
3. Figma 스펙이 있으면 (`spec.figmaSpec.enabled === true`):
   - `colorTokens`를 CSS 변수 또는 Tailwind config 값으로 변환
   - 컴포넌트 구조를 Figma 계층에 맞게 구현
4. 기존 코드베이스 패턴 파악 후 동일 스타일로 작성 (TypeScript, 테스트 파일 위치 등)
5. 각 파일 구현 후 `appendLog` 호출:
   ```bash
   npx @elyun/bylane state append code-agent "FILENAME 구현 완료"
   ```
6. 구현 완료 후 상태 업데이트:
   ```bash
   npx @elyun/bylane state write code-agent '{"status":"completed","progress":100,"currentTask":"구현 완료","retries":0,"changedFiles":CHANGED_FILES_ARRAY}'
   ```

## 코딩 원칙

- 함수형 컴포넌트 + hooks 우선
- 파일당 단일 책임
- 200줄 초과 시 분리 고려
- 불변성 패턴 유지 (객체 직접 수정 금지)

## 출력

`.bylane/state/code-agent.json`의 `changedFiles`: 변경된 파일 경로 배열

## 수동 실행

`/bylane code #123`
