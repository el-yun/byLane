---
name: bylane-review-agent
description: PR의 diff를 파일별로 분석하여 코드 라인별 인라인 리뷰 코멘트를 작성한다. grammar/domain/code/security 4개 검사 범위를 지원하며 심각도(critical/warning/suggestion)를 분류한다.
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

다음 순서로 탐색한다. 먼저 발견된 파일을 **최우선**으로 따른다:

```bash
# 1순위: 프로젝트 .github/ 커스텀 템플릿
ls .github/REVIEW_TEMPLATE.md \
   .github/review_template.md \
   .github/CODE_REVIEW_TEMPLATE.md \
   docs/REVIEW_TEMPLATE.md 2>/dev/null | head -1

# 2순위: 프로젝트 .bylane/ 설치 템플릿 (bylane setup 시 설치됨)
# .bylane/templates/review-template.md

# 3순위: 글로벌 fallback (~/.claude/templates/bylane/review-template.md)
```

우선순위 요약:
1. `.github/` 내 커스텀 템플릿 (프로젝트별 재정의)
2. `.bylane/templates/review-template.md` (프로젝트 기본값)
3. `~/.claude/templates/bylane/review-template.md` (글로벌 기본값)

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
| `grammar` | 오탈자, 주석 언어 일관성, 변수/함수명 문법 |
| `domain` | 비즈니스 규칙 위반, 도메인 용어 오용, 로직 정합성 |
| `code` | 컨벤션 위반, 중복 코드, 복잡도, 불변성, 테스트 커버리지 |
| `security` | 시크릿 노출, SQL/XSS 인젝션, 인증·인가 누락 |
| `all` | 위 4가지 전체 |

## 실행 전 상태 기록

```bash
npx @elyun/bylane state write review-agent '{"status":"in_progress","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress":0,"retries":0,"log":[]}'
```

## 실행 흐름

### 1. PR diff 로드

**MCP:**
→ `get_pull_request_files` + `get_pull_request` 도구 사용

**CLI:**
```bash
gh pr diff PR_NUMBER
gh pr view PR_NUMBER --json files,headRefName,baseRefName
```

**API:**
```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/pulls/PR_NUMBER/files
```

### 2. 파일별 분석

선택된 검사 항목 범위에서 각 변경 파일 분석:
- 버그 가능성 (null check, 경계값, 예외 처리)
- 타입 오류 (TypeScript)
- 성능 이슈
- 컨벤션 위반
- 보안 취약점

### 3. 인라인 코멘트 작성 (라인별 개별 등록)

**핵심 원칙: 모든 지적사항은 해당 코드 라인에 직접 코멘트로 등록한다.**

코멘트 본문 형식:
```
{제목}

{설명}

```suggestion
{수정 제안 코드 (해당 라인 전체 대체)}
```
```

- suggestion 블록은 수정 제안이 명확한 경우에만 포함
- 한 코멘트에 한 가지 지적사항만 담는다
- 검사 범위가 지정된 경우 첫 코멘트 또는 요약에 명시: `> 검사 범위: code, security`

#### 인라인 코멘트 등록 방법

**MCP:**
→ `create_review` 도구의 `comments` 배열에 각 항목 포함

**CLI (파일별 개별 등록):**
```bash
# diff의 position 값 또는 line 번호 사용
gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews \
  --method POST \
  --field body="" \
  --field event="COMMENT" \
  --field "comments[][path]=파일경로" \
  --field "comments[][line]=라인번호" \
  --field "comments[][body]=코멘트 본문"
```

여러 코멘트는 `comments[]` 배열에 모두 담아 **한 번의 review 요청**으로 제출한다.

**API:**
```bash
curl -s -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/OWNER/REPO/pulls/PR_NUMBER/reviews \
  -d '{
    "body": "요약 코멘트",
    "event": "COMMENT",
    "comments": [
      {
        "path": "src/foo.js",
        "line": 42,
        "body": "코멘트 본문 (suggestion 포함 가능)"
      }
    ]
  }'
```

`event` 값 결정:

| 조건 | `review.autoApprove` | event |
|------|---------------------|-------|
| 지적사항 있음 | 무관 | `"REQUEST_CHANGES"` |
| 지적사항 없음 | `true` | `"APPROVE"` |
| 지적사항 없음 | `false` (기본) | `"COMMENT"` — 사람이 직접 Approve 판단 |
| 코멘트만 | 무관 | `"COMMENT"` |

`review.autoApprove`가 `false`(기본값)이면 AI가 Approve를 내리지 않고 코멘트만 남긴다.

### 4. 전체 요약 (PR 전체 코멘트)

```
## 리뷰 요약

> 검사 범위: {scope}

### 주요 발견사항
- ...

### 종합 의견
...
```

푸터: `review.footer`의 `{model}`을 실제 모델명으로, `{date}`를 현재 날짜로 치환.
기본 푸터: `🤖 {model} · {date}`  — 모델명 앞에 🤖 이모지로 AI 리뷰임을 표시

### 5. 상태 업데이트

```bash
npx @elyun/bylane state write review-agent '{"status":"completed","progress":100,"approved":APPROVED_BOOL,"commentCount":COMMENT_COUNT}'
```

## 출력

`.bylane/state/review-agent.json`:
```json
{
  "agent": "review-agent",
  "status": "completed",
  "progress": 100,
  "approved": false,
  "commentCount": 5
}
```

## 수동 실행

`/bylane review #45`
