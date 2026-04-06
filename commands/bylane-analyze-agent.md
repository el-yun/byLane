---
name: bylane-analyze-agent
description: 프로젝트의 코드 스타일, 디자인 토큰, 아키텍처, 폴더 구조, 의존성을 병렬 분석하여 .claude/instructions/ 하위에 instruction 파일로 저장한다. CLAUDE.md에 import를 자동 추가하여 이후 에이전트가 프로젝트 컨텍스트를 활용할 수 있게 한다.
---

# Analyze Agent

프로젝트의 코드 스타일, 디자인 토큰, 아키텍처, 폴더 구조를 분석하여
Claude Code가 해당 프로젝트의 컨텍스트를 이해할 수 있는 instruction 파일을 생성한다.

**사용 모델: `claude-opus-4-6`** — 정확한 패턴 추론을 위해 Opus를 사용한다.
orchestrator에서 이 에이전트를 호출할 때 `model: "claude-opus-4-6"`을 전달한다.

## 실행 전 상태 기록

```bash
node -e "
import('PATH_TO_BYLANE/src/state.js').then(({writeState}) => {
  writeState('analyze-agent', {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    progress: 0,
    currentTask: '프로젝트 분석 시작',
    retries: 0,
    log: []
  })
})
"
```

## Step 1 — 분석 대상 파일 수집

다음 파일들을 읽어 분석 데이터를 수집한다:

### 코드 스타일 관련
```bash
# ESLint
cat .eslintrc* eslint.config* .eslintignore 2>/dev/null

# Prettier
cat .prettierrc* prettier.config* 2>/dev/null

# TypeScript
cat tsconfig*.json 2>/dev/null

# Stylelint
cat .stylelintrc* 2>/dev/null

# EditorConfig
cat .editorconfig 2>/dev/null

# 실제 소스 파일 샘플 (패턴 파악용)
find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | head -20
```

### 디자인 토큰 관련
```bash
# Tailwind
cat tailwind.config* 2>/dev/null

# CSS 변수
grep -r "^:root" --include="*.css" --include="*.scss" -l 2>/dev/null | head -5

# styled-components / emotion 테마
find src -name "theme*" -o -name "tokens*" -o -name "colors*" 2>/dev/null | head -10

# CSS modules
find src -name "*.module.css" -o -name "*.module.scss" 2>/dev/null | head -5

# design system
find . -path "*/design-system/*" -o -path "*/design-tokens/*" 2>/dev/null | head -10
```

### 아키텍처 관련
```bash
# package.json (의존성, 스크립트)
cat package.json 2>/dev/null

# Next.js
cat next.config* 2>/dev/null

# Vite
cat vite.config* 2>/dev/null

# 상태 관리
grep -r "createStore\|configureStore\|createSlice\|useRecoilState\|atom\|create(" \
  --include="*.ts" --include="*.tsx" -l 2>/dev/null | head -5

# 라우팅
find src -name "router*" -o -name "routes*" -o -name "routing*" 2>/dev/null | head -5
```

### 폴더 구조
```bash
find . -maxdepth 4 \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/.next/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/.bylane/*" \
  -type f | head -100
```

## Step 2 — 각 영역 분석 및 정리

수집된 데이터를 바탕으로 아래 네 가지 영역을 분석한다.

### 2-1. 코드 스타일 분석

다음 항목을 파악한다:
- **언어**: TypeScript / JavaScript / 혼용 여부, strict 모드
- **포맷팅**: indent(공백/탭, 너비), 따옴표 스타일, 세미콜론, trailing comma, print width
- **네이밍 컨벤션**: 컴포넌트(PascalCase), 함수/변수(camelCase), 상수(UPPER_CASE), 파일명 패턴
- **import 순서**: 외부 라이브러리 → 내부 모듈 순 여부, 절대경로 alias (`@/`, `~/`)
- **컴포넌트 패턴**: 함수형/클래스형, default/named export, props 타입 정의 방식
- **주석 스타일**: JSDoc, 인라인 주석 언어 (한국어/영어)
- **금지 패턴**: `console.log`, `any` 타입, `!` non-null assertion 등

### 2-2. 디자인 토큰 분석

다음 항목을 파악한다:
- **색상**: primary, secondary, accent, background, text, border, error, success, warning 팔레트
- **타이포그래피**: font-family, font-size 스케일, font-weight, line-height, letter-spacing
- **간격**: spacing 스케일 (4/8px 기반 등)
- **브레이크포인트**: mobile/tablet/desktop 분기점
- **반응형 접근**: mobile-first / desktop-first
- **다크모드**: CSS 변수 기반 / Tailwind dark: / 별도 테마 객체
- **그림자, 테두리 반경**: shadow, border-radius 스케일
- **토큰 위치**: 어느 파일/변수에 정의되어 있는지

토큰을 찾지 못한 경우 "감지되지 않음" 으로 표기.

### 2-3. 아키텍처 분석

다음 항목을 파악한다:
- **프레임워크**: Next.js / Vite+React / Vue / Nuxt 등, 버전
- **렌더링 전략**: SSR / SSG / CSR / ISR, App Router / Pages Router
- **상태 관리**: Redux / Zustand / Recoil / Jotai / Context API / 없음
- **데이터 페칭**: SWR / React Query / Apollo / fetch / axios, 캐싱 전략
- **폼 관리**: React Hook Form / Formik / 직접 구현
- **스타일링**: Tailwind / CSS Modules / styled-components / emotion / 혼용
- **테스트**: Jest / Vitest / Testing Library / Playwright / Cypress
- **주요 서드파티 의존성**: 핵심 라이브러리 목록과 용도

### 2-4. 폴더 구조 분석

다음 항목을 파악한다:
- **최상위 디렉토리**: `src/`, `app/`, `pages/`, `components/`, `lib/`, `utils/`, `hooks/` 등
- **컴포넌트 조직**: feature-based / type-based / atomic design
- **공유 코드 위치**: 공통 컴포넌트, 유틸, 훅의 위치
- **API/서버 코드 위치**: `api/`, `server/`, `services/`
- **에셋 위치**: 이미지, 폰트, 아이콘
- **환경 설정**: `.env` 파일 구조

## Step 3 — instruction 파일 생성

`.claude/instructions/` 디렉토리를 생성하고 각 파일을 저장한다:

```bash
mkdir -p .claude/instructions
```

### `.claude/instructions/code-style.md`

```markdown
# 코드 스타일 가이드

> byLane analyze-agent가 자동 생성 · 마지막 업데이트: {날짜}
> 수동 수정 가능. `/bylane analyze`로 재분석하면 덮어씁니다.

## 언어 및 타입
{TypeScript/JavaScript 버전, strict 설정}

## 포맷팅
- indent: {2 or 4 spaces / tabs}
- 따옴표: {single / double}
- 세미콜론: {있음 / 없음}
- trailing comma: {all / es5 / none}
- print width: {80 / 100 / 120}

## 네이밍 컨벤션
- 컴포넌트: PascalCase (`UserProfile`, `DarkModeToggle`)
- 함수/변수: camelCase
- 상수: {UPPER_SNAKE_CASE / camelCase}
- 파일명: {kebab-case / PascalCase / camelCase}
- CSS 클래스: {BEM / camelCase / kebab-case}

## Import
- 경로 alias: {`@/` → `src/`, 없음}
- import 순서: 외부 라이브러리 → 내부 경로 → 상대 경로
{추가 import 규칙}

## 컴포넌트 패턴
{함수형 컴포넌트 예시, props 타입 정의 방식}

## 주석
- 언어: {한국어 / 영어}
- 스타일: {JSDoc / 인라인 // / 없음}

## 금지 패턴
{eslint 규칙에서 추출한 주요 금지 패턴}
```

### `.claude/instructions/design-tokens.md`

```markdown
# 디자인 토큰

> byLane analyze-agent가 자동 생성 · 마지막 업데이트: {날짜}
> 수동 수정 가능. `/bylane analyze`로 재분석하면 덮어씁니다.

## 색상 팔레트
{발견된 색상 토큰 — CSS 변수명 또는 Tailwind 키 포함}

예시 형식:
| 용도 | 변수명 / 클래스 | 값 |
|---|---|---|
| Primary | `--color-primary` / `bg-primary-500` | `#3B82F6` |

## 타이포그래피
{font-family, size 스케일, weight, line-height}

## 간격 스케일
{spacing 값 — Tailwind 기본 / 커스텀 스케일}

## 브레이크포인트
{sm/md/lg/xl 분기점}

## 반응형 전략
{mobile-first / desktop-first, 사용 방법}

## 다크모드
{지원 여부, 구현 방식}

## 토큰 파일 위치
{실제 토큰이 정의된 파일 경로}
```

### `.claude/instructions/architecture.md`

```markdown
# 프로젝트 아키텍처

> byLane analyze-agent가 자동 생성 · 마지막 업데이트: {날짜}
> 수동 수정 가능. `/bylane analyze`로 재분석하면 덮어씁니다.

## 프레임워크 & 런타임
- 프레임워크: {Next.js 14 App Router / Vite + React 18 / ...}
- Node.js: {버전}
- 패키지 매니저: {npm / yarn / pnpm}

## 렌더링 전략
{SSR / SSG / CSR / ISR, 어떤 페이지에 어떤 전략 사용}

## 상태 관리
{라이브러리, 스토어 위치, 사용 패턴}

## 데이터 페칭
{라이브러리, 패턴, API base URL 위치}

## 스타일링
{라이브러리, 설정 파일 위치}

## 테스트
{프레임워크, 실행 명령, 테스트 파일 위치 패턴}

## 주요 의존성
{핵심 라이브러리와 용도 목록}

## 폴더 구조
{프로젝트 디렉토리 트리 (핵심 부분만)}

## 컨벤션
{이 프로젝트 특유의 패턴이나 주의사항}
```

## Step 4 — CLAUDE.md 업데이트

### CLAUDE.md 존재 확인

```bash
test -f CLAUDE.md && echo "exists" || echo "not_found"
```

**없는 경우**: `/init` 커맨드를 실행하여 CLAUDE.md를 먼저 생성한다.
CLAUDE.md 생성 후 Step 4를 계속한다.

### import 섹션 추가

CLAUDE.md의 상단 (첫 번째 `#` 헤딩 이전) 또는 기존 import 블록 뒤에 아래 내용을 추가한다.
이미 같은 경로가 있으면 중복 추가하지 않는다:

```markdown
@.claude/instructions/code-style.md
@.claude/instructions/design-tokens.md
@.claude/instructions/architecture.md
```

Claude Code는 CLAUDE.md에서 `@경로` 형식으로 다른 파일을 자동으로 로드한다.

### 추가 방법

```python
# 의사코드 — Read 도구로 CLAUDE.md 읽은 후 Edit 도구로 수정
lines = read("CLAUDE.md")
imports_to_add = [
    "@.claude/instructions/code-style.md",
    "@.claude/instructions/design-tokens.md",
    "@.claude/instructions/architecture.md",
]
# 이미 있는 항목 제외
missing = [i for i in imports_to_add if i not in lines]
if missing:
    # 첫 번째 줄에 삽입 (또는 기존 @ import 블록 마지막에 추가)
    insert_at_top(missing)
```

## Step 5 — 완료 처리

```bash
node -e "
import('PATH_TO_BYLANE/src/state.js').then(({writeState}) => {
  writeState('analyze-agent', {
    status: 'completed',
    progress: 100,
    currentTask: '분석 완료',
    retries: 0,
    generatedFiles: [
      '.claude/instructions/code-style.md',
      '.claude/instructions/design-tokens.md',
      '.claude/instructions/architecture.md'
    ]
  })
})
"
```

분석 결과 요약을 사용자에게 출력한다:

```
분석 완료!

생성된 파일:
  .claude/instructions/code-style.md    — 코드 스타일, 네이밍 컨벤션
  .claude/instructions/design-tokens.md — 색상, 타이포, 간격, 브레이크포인트
  .claude/instructions/architecture.md  — 프레임워크, 상태관리, 주요 의존성

CLAUDE.md에 import 추가 완료.
다음 Claude Code 세션부터 이 프로젝트의 컨텍스트를 자동으로 로드합니다.

재분석: /bylane analyze
```

## 수동 실행

```
/bylane analyze
```

## 주의사항

- `--force` 옵션: 기존 instruction 파일을 강제로 덮어씀
  기본값: 파일이 이미 있으면 덮어쓰기 전에 사용자에게 확인 요청
- 디자인 토큰이나 코드 스타일이 감지되지 않은 항목은 "감지되지 않음" 으로 표기하고,
  사용자가 직접 채울 수 있도록 TODO 주석을 남긴다
- `.claude/instructions/` 파일은 수동으로 수정해도 된다 — `/bylane analyze` 재실행 시 덮어쓰므로
  커스텀 내용은 별도 파일로 분리하거나 `@.claude/instructions/structure.md` 를 직접 작성한다
