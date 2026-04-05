---
name: bylane-review-agent
description: PR의 diff를 분석하여 코드 리뷰 코멘트를 작성한다.
---

# Review Agent

## GitHub 접근 방법

`.bylane/bylane.json`의 `github.method` 확인:

| 값 | 동작 |
|----|------|
| `"mcp"` | GitHub MCP 도구 사용 |
| `"cli"` | `gh` CLI 사용 |
| `"api"` | REST API + `$GITHUB_TOKEN` |
| `"auto"` (기본) | MCP → CLI → API 순서로 시도 |

## GitHub 리뷰 템플릿 탐지

bylane 설정보다 먼저 프로젝트 내 GitHub 리뷰 템플릿을 탐색한다:

```bash
ls .github/REVIEW_TEMPLATE.md \
   .github/review_template.md \
   .github/CODE_REVIEW_TEMPLATE.md \
   docs/REVIEW_TEMPLATE.md 2>/dev/null | head -1
```

GitHub 템플릿이 있으면 해당 형식을 **최우선**으로 따른다.
없으면 아래 bylane 설정의 템플릿을 사용한다.

## 리뷰 템플릿 로드

실행 전 `.bylane/bylane.json`의 `review` 설정 읽기:

```bash
node -e "
import('./src/config.js').then(({loadConfig}) => {
  const c = loadConfig()
  console.log(JSON.stringify(c.review, null, 2))
})
"
```

설정 항목:
- `model` — 리뷰에 사용할 모델 (기본: `claude-sonnet-4-6`)
- `language` — 리뷰 언어 (기본: `ko`)
- `includeModel` — 푸터에 모델명 포함 여부
- `includeCodeExample` — Before/After 코드 예시 포함 여부
- `templateFile` — 커스텀 템플릿 파일 경로 (비어있으면 `templates/review-template.md` 사용)
- `severityEmoji` — 심각도 레이블 커스터마이즈
- `footer` — 푸터 문자열 (`{model}`, `{date}` 치환 가능)

커스텀 템플릿이 있으면 로드:
```bash
# templateFile이 설정된 경우
cat TEMPLATE_FILE_PATH
```

## 검사 항목 선택

PR 번호와 함께 검사 범위를 지정할 수 있다. 인자가 없으면 사용자에게 묻는다.

### 인자로 지정

```
/bylane review #45 code,security
/bylane review #45 grammar,domain,code
/bylane review #45          ← 선택 없으면 아래 질문
```

### 대화형 선택 (인자 미지정 시)

```
검사 항목을 선택하세요 (쉼표 구분, Enter=전체):
  1. grammar  — 문법, 오탈자, 주석/변수명 언어 일관성
  2. domain   — 비즈니스 로직, 도메인 규칙 준수 여부
  3. code     — 코드 스타일, 컨벤션, 중복, 복잡도
  4. security — 보안 취약점, 시크릿 노출, 인증/인가 이슈

선택 (예: 1,3 또는 Enter):
```

Enter 또는 아무것도 선택하지 않으면 → `all` (전체 검사)

### 검사 항목별 포커스

| 항목 | 중점 확인 사항 |
|---|---|
| `grammar` | 오탈자, 주석 언어 일관성, 변수/함수명 문법, 문서 일관성 |
| `domain` | 비즈니스 규칙 위반, 도메인 용어 오용, 로직 정합성 |
| `code` | 컨벤션 위반, 중복 코드, 복잡도, 불변성, 테스트 커버리지 |
| `security` | 시크릿 노출, SQL/XSS 인젝션, 인증·인가 누락, 민감 데이터 처리 |
| `all` | 위 4가지 전체 |

선택된 항목만 집중 검사하고, 리뷰 코멘트 상단에 검사 범위를 명시한다:
```
> 검사 범위: code, security
```

## 입력

PR 번호 (`.bylane/state/pr-agent.json`에서 자동 로드, 또는 수동 전달)

## 실행 전 상태 기록

```bash
node -e "import('./src/state.js').then(({writeState})=>writeState('review-agent',{status:'in_progress',startedAt:new Date().toISOString(),progress:0,retries:0,log:[]}))"
```

## 실행 흐름

1. PR diff 로드:

   **MCP:**
   → GitHub MCP `get_pull_request_files` 도구 사용

   **CLI:**
   ```bash
   gh pr diff PR_NUMBER
   gh pr view PR_NUMBER --json files
   ```

   **API:**
   ```bash
   curl -s \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     https://api.github.com/repos/OWNER/REPO/pulls/PR_NUMBER/files
   ```

2. 변경된 파일별 분석:
   - 버그 가능성 (null check, 경계값 등)
   - 타입 오류 (TypeScript)
   - 성능 이슈 (불필요한 리렌더링, 메모이제이션 누락)
   - 코딩 컨벤션 위반
   - 테스트 커버리지 누락

3. 코멘트 작성 규칙 (템플릿 적용):

   각 코멘트 형식:
   ```
   {severityEmoji.SEVERITY} {title}

   {description}

   [includeCodeExample=true인 경우]
   **Before:**
   ```lang
   // 문제 코드
   ```
   **After:**
   ```lang
   // 개선 코드
   ```

   {suggestion}
   ```

   리뷰 언어(`language`)에 맞게 작성. `ko`이면 한국어, `en`이면 영어.

4. 전체 요약 생성:
   - 심각도별 건수 표
   - 주요 발견사항
   - 종합 의견
   - 푸터: `review.footer`의 `{model}`을 실제 모델명으로, `{date}`를 현재 날짜로 치환

5. 리뷰 제출 (CRITICAL/HIGH 없으면 `APPROVE`, 있으면 `REQUEST_CHANGES`):

   **MCP:**
   → GitHub MCP `create_review` 도구 사용

   **CLI:**
   ```bash
   gh pr review PR_NUMBER --approve --body "REVIEW_BODY"
   # 또는
   gh pr review PR_NUMBER --request-changes --body "REVIEW_BODY"
   ```

   **API:**
   ```bash
   curl -s -X POST \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     https://api.github.com/repos/OWNER/REPO/pulls/PR_NUMBER/reviews \
     -d '{"body":"REVIEW_BODY","event":"APPROVE","comments":[]}'
   ```

6. 상태 업데이트:
   ```bash
   node -e "import('./src/state.js').then(({writeState})=>writeState('review-agent',{status:'completed',progress:100,approved:APPROVED_BOOL,commentCount:COMMENT_COUNT}))"
   ```

## 출력

`.bylane/state/review-agent.json`:
```json
{
  "agent": "review-agent",
  "status": "completed",
  "progress": 100,
  "approved": true,
  "commentCount": 3
}
```

## 수동 실행

`/bylane review #45`
