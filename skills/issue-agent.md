---
name: bylane-issue-agent
description: GitHub Issue 생성 및 분석. Figma 링크 감지 시 스펙 추출.
---

# Issue Agent

## 입력

- 자유 텍스트 (새 이슈 생성용) OR GitHub Issue 번호 (#N)

## 실행 흐름

### 새 이슈 생성 모드 (텍스트 입력)

1. 입력 텍스트에서 다음을 추출:
   - 제목 (50자 이내)
   - 상세 설명
   - 구현 체크리스트 (예상 가능한 경우)
   - Figma URL (있는 경우)

2. GitHub MCP로 이슈 생성:
   - `title`: 추출된 제목
   - `body`: Markdown 형식 설명 + 체크리스트
   - `labels`: `bylane-auto` 라벨 추가 (라벨이 없으면 생성)

3. Figma MCP 활성화 여부 확인 (`.bylane/bylane.json` → `extensions.figma.enabled`):
   - `true`이고 Figma URL이 있으면 → **Figma 분석** 단계 실행
   - `false`이면 → 텍스트 기반 스펙만 생성

### 기존 이슈 분석 모드 (Issue 번호 입력)

1. GitHub MCP로 이슈 내용 로드
2. 본문에서 Figma URL 추출 시도
3. 스펙 생성 (아래 참조)

### Figma 분석 (활성화된 경우)

Figma MCP `get_file` 또는 `get_node` 도구로 해당 프레임/컴포넌트 분석:
- 컴포넌트 계층 구조
- 색상 토큰
- 타이포그래피
- 스페이싱 값

추출 결과를 스펙에 포함.

## 출력: 구현 스펙

`.bylane/state/issue-agent.json`에 저장:

```json
{
  "agent": "issue-agent",
  "status": "completed",
  "issueNumber": 123,
  "issueUrl": "https://github.com/...",
  "spec": {
    "title": "다크모드 토글 버튼 추가",
    "description": "...",
    "checklist": ["ThemeToggle 컴포넌트 생성", "useTheme hook 구현"],
    "figmaSpec": {
      "enabled": false,
      "components": [],
      "colorTokens": {}
    }
  }
}
```

상태 기록:
```bash
node -e "
import('./src/state.js').then(({writeState, appendLog}) => {
  writeState('issue-agent', {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    progress: 0,
    retries: 0
  })
})
"
```

## 수동 실행

`/bylane issue #123` 또는 `/bylane issue 다크모드 토글 추가해줘`
