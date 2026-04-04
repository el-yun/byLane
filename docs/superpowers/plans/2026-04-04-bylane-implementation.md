# byLane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code 위에서 동작하는 프론트엔드 개발 자동화 하네스를 Skills 파일 세트 + Node.js 유틸리티로 구현한다.

**Architecture:** 오케스트레이터 skill이 자연어 의도를 파싱해 8개의 워커 에이전트를 순차/병렬로 호출한다. 각 에이전트는 `.bylane/state/*.json`에 상태를 기록하고, 별도 Node.js 프로세스인 모니터 대시보드가 이를 폴링해 2열 TUI로 표시한다. 모든 에이전트는 수동 단독 실행도 가능하다.

**Tech Stack:** Claude Code Skills (Markdown), Node.js 20+, blessed (TUI), Vitest (테스트), GitHub MCP, Figma MCP (선택), Slack MCP, Telegram MCP

---

## 파일 구조

```
byLane/
├── package.json                       # Node.js 패키지 (monitor + 유틸)
├── src/
│   ├── state.js                       # 에이전트 상태 read/write
│   ├── config.js                      # bylane.json 로드/검증/저장
│   ├── branch.js                      # 브랜치명 패턴 엔진
│   └── monitor/
│       ├── index.js                   # TUI 엔트리포인트 (bin)
│       ├── layout.js                  # blessed 레이아웃 정의
│       ├── poller.js                  # state 파일 폴링 (1초)
│       └── panels/
│           ├── header.js              # 헤더 패널
│           ├── pipeline.js            # Agent Pipeline 패널 (좌상)
│           ├── log.js                 # Agent Log 패널 (우상)
│           ├── queue.js               # Queue 패널 (좌하)
│           └── status.js             # System Status 패널 (우하)
├── tests/
│   ├── state.test.js
│   ├── config.test.js
│   └── branch.test.js
├── skills/
│   ├── orchestrator.md               # 전체 워크플로우 총괄
│   ├── setup.md                      # 셋업 위자드
│   ├── issue-agent.md
│   ├── code-agent.md
│   ├── test-agent.md
│   ├── commit-agent.md
│   ├── pr-agent.md
│   ├── review-agent.md
│   ├── respond-agent.md
│   └── notify-agent.md
├── hooks/
│   └── post-tool-use.md              # 외부 이벤트 감지
├── commands/
│   ├── bylane.md                     # /bylane 메인 커맨드
│   └── bylane-monitor.md             # /bylane monitor 대시보드
└── CLAUDE.md
```

---

## Phase 1: 프로젝트 스캐폴드 + 유틸리티 기반

### Task 1: package.json 및 프로젝트 초기화

**Files:**
- Create: `package.json`
- Create: `src/state.js`
- Create: `src/config.js`
- Create: `src/branch.js`

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "bylane",
  "version": "1.0.0",
  "description": "Frontend development harness for Claude Code",
  "type": "module",
  "bin": {
    "bylane-monitor": "./src/monitor/index.js"
  },
  "scripts": {
    "monitor": "node src/monitor/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "blessed": "^0.1.81",
    "chokidar": "^3.6.0"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: 디렉토리 생성**

```bash
mkdir -p src/monitor/panels tests skills hooks commands .bylane/state
```

- [ ] **Step 3: npm install**

```bash
npm install
```

Expected: `node_modules/` 생성, `blessed`, `chokidar`, `vitest` 설치됨

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 프로젝트 초기화 및 의존성 설치"
```

---

### Task 2: 상태 관리 모듈 (`src/state.js`)

**Files:**
- Create: `tests/state.test.js`
- Create: `src/state.js`

- [ ] **Step 1: 실패 테스트 작성**

```js
// tests/state.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readState, writeState, clearState, listStates } from '../src/state.js'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

const TEST_DIR = '.bylane-test/state'

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }))
afterEach(() => rmSync('.bylane-test', { recursive: true, force: true }))

describe('writeState', () => {
  it('에이전트 상태를 JSON 파일에 저장한다', () => {
    writeState('code-agent', { status: 'in_progress', progress: 50 }, TEST_DIR)
    const result = readState('code-agent', TEST_DIR)
    expect(result.status).toBe('in_progress')
    expect(result.progress).toBe(50)
  })
})

describe('readState', () => {
  it('존재하지 않는 에이전트는 null을 반환한다', () => {
    const result = readState('nonexistent', TEST_DIR)
    expect(result).toBeNull()
  })

  it('저장된 상태에 agent 이름과 updatedAt이 포함된다', () => {
    writeState('issue-agent', { status: 'completed' }, TEST_DIR)
    const result = readState('issue-agent', TEST_DIR)
    expect(result.agent).toBe('issue-agent')
    expect(result.updatedAt).toBeDefined()
  })
})

describe('clearState', () => {
  it('특정 에이전트 상태 파일을 삭제한다', () => {
    writeState('pr-agent', { status: 'idle' }, TEST_DIR)
    clearState('pr-agent', TEST_DIR)
    expect(readState('pr-agent', TEST_DIR)).toBeNull()
  })
})

describe('listStates', () => {
  it('모든 에이전트 상태 목록을 반환한다', () => {
    writeState('code-agent', { status: 'completed' }, TEST_DIR)
    writeState('test-agent', { status: 'idle' }, TEST_DIR)
    const list = listStates(TEST_DIR)
    expect(list).toHaveLength(2)
    expect(list.map(s => s.agent)).toContain('code-agent')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- tests/state.test.js
```

Expected: FAIL — `Cannot find module '../src/state.js'`

- [ ] **Step 3: state.js 구현**

```js
// src/state.js
import { readFileSync, writeFileSync, unlinkSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const DEFAULT_DIR = '.bylane/state'

export function writeState(agentName, data, dir = DEFAULT_DIR) {
  const payload = {
    ...data,
    agent: agentName,
    updatedAt: new Date().toISOString(),
    log: data.log ?? []
  }
  writeFileSync(join(dir, `${agentName}.json`), JSON.stringify(payload, null, 2))
}

export function readState(agentName, dir = DEFAULT_DIR) {
  const path = join(dir, `${agentName}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function clearState(agentName, dir = DEFAULT_DIR) {
  const path = join(dir, `${agentName}.json`)
  if (existsSync(path)) unlinkSync(path)
}

export function listStates(dir = DEFAULT_DIR) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => readState(f.replace('.json', ''), dir))
    .filter(Boolean)
}

export function appendLog(agentName, message, dir = DEFAULT_DIR) {
  const state = readState(agentName, dir) ?? { agent: agentName, status: 'idle', log: [] }
  const entry = { ts: new Date().toISOString(), msg: message }
  writeState(agentName, { ...state, log: [...(state.log ?? []), entry] }, dir)
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/state.test.js
```

Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/state.js tests/state.test.js
git commit -m "feat: 에이전트 상태 관리 모듈 구현"
```

---

### Task 3: 설정 모듈 (`src/config.js`)

**Files:**
- Create: `tests/config.test.js`
- Create: `src/config.js`

- [ ] **Step 1: 실패 테스트 작성**

```js
// tests/config.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadConfig, saveConfig, validateConfig, DEFAULT_CONFIG } from '../src/config.js'
import { mkdirSync, rmSync, writeFileSync } from 'fs'

const TEST_DIR = '.bylane-test'

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }))
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

describe('DEFAULT_CONFIG', () => {
  it('기본 maxRetries는 3이다', () => {
    expect(DEFAULT_CONFIG.workflow.maxRetries).toBe(3)
  })

  it('기본 primary tracker는 github이다', () => {
    expect(DEFAULT_CONFIG.trackers.primary).toBe('github')
  })
})

describe('loadConfig', () => {
  it('파일이 없으면 DEFAULT_CONFIG를 반환한다', () => {
    const config = loadConfig(TEST_DIR)
    expect(config.workflow.maxRetries).toBe(3)
  })

  it('존재하는 설정 파일을 로드한다', () => {
    writeFileSync(`${TEST_DIR}/bylane.json`, JSON.stringify({
      ...DEFAULT_CONFIG,
      workflow: { ...DEFAULT_CONFIG.workflow, maxRetries: 5 }
    }))
    const config = loadConfig(TEST_DIR)
    expect(config.workflow.maxRetries).toBe(5)
  })
})

describe('saveConfig', () => {
  it('설정을 bylane.json에 저장한다', () => {
    saveConfig({ ...DEFAULT_CONFIG }, TEST_DIR)
    const loaded = loadConfig(TEST_DIR)
    expect(loaded.version).toBe('1.0')
  })
})

describe('validateConfig', () => {
  it('유효한 설정은 에러가 없다', () => {
    const errors = validateConfig(DEFAULT_CONFIG)
    expect(errors).toHaveLength(0)
  })

  it('maxRetries가 숫자가 아니면 에러를 반환한다', () => {
    const bad = { ...DEFAULT_CONFIG, workflow: { ...DEFAULT_CONFIG.workflow, maxRetries: 'abc' } }
    const errors = validateConfig(bad)
    expect(errors.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- tests/config.test.js
```

Expected: FAIL — `Cannot find module '../src/config.js'`

- [ ] **Step 3: config.js 구현**

```js
// src/config.js
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export const DEFAULT_CONFIG = {
  version: '1.0',
  trackers: {
    primary: 'github',
    linear: { enabled: false, apiKey: '' }
  },
  notifications: {
    slack: { enabled: false, channel: '' },
    telegram: { enabled: false, chatId: '' }
  },
  team: {
    enabled: false,
    members: [],
    reviewAssignment: 'round-robin'
  },
  permissions: {
    scope: 'write',
    allowMerge: false,
    allowForceClose: false
  },
  workflow: {
    maxRetries: 3,
    loopTimeoutMinutes: 30,
    autoEscalate: true
  },
  branch: {
    pattern: '{tracker}-{issue-number}',
    tokens: { tracker: 'issues', type: 'feature', 'custom-id': '' },
    separator: '-',
    caseStyle: 'kebab-case'
  },
  extensions: {
    figma: { enabled: false, useAt: 'issue-analysis' }
  }
}

export function loadConfig(dir = '.bylane') {
  const path = join(dir, 'bylane.json')
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config, dir = '.bylane') {
  const path = join(dir, 'bylane.json')
  writeFileSync(path, JSON.stringify(config, null, 2))
}

export function validateConfig(config) {
  const errors = []
  if (typeof config.workflow?.maxRetries !== 'number') {
    errors.push('workflow.maxRetries must be a number')
  }
  if (!['github', 'linear', 'both'].includes(config.trackers?.primary)) {
    errors.push('trackers.primary must be "github", "linear", or "both"')
  }
  if (!['read-only', 'write', 'full'].includes(config.permissions?.scope)) {
    errors.push('permissions.scope must be "read-only", "write", or "full"')
  }
  return errors
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/config.test.js
```

Expected: PASS — 6 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat: bylane.json 설정 로드/저장/검증 모듈 구현"
```

---

### Task 4: 브랜치 네이밍 엔진 (`src/branch.js`)

**Files:**
- Create: `tests/branch.test.js`
- Create: `src/branch.js`

- [ ] **Step 1: 실패 테스트 작성**

```js
// tests/branch.test.js
import { describe, it, expect } from 'vitest'
import { buildBranchName } from '../src/branch.js'

describe('buildBranchName', () => {
  it('{tracker}-{issue-number} 패턴 기본 케이스', () => {
    const result = buildBranchName(
      '{tracker}-{issue-number}',
      { tracker: 'issues', 'issue-number': '32' }
    )
    expect(result).toBe('issues-32')
  })

  it('{custom-id}가 비어있으면 해당 토큰과 앞 구분자를 제외한다', () => {
    const result = buildBranchName(
      '{tracker}-{issue-number}-{custom-id}',
      { tracker: 'issues', 'issue-number': '32', 'custom-id': '' }
    )
    expect(result).toBe('issues-32')
  })

  it('{custom-id}가 있으면 포함한다', () => {
    const result = buildBranchName(
      '{tracker}-{issue-number}-{custom-id}',
      { tracker: 'issues', 'issue-number': '32', 'custom-id': 'C-12' }
    )
    expect(result).toBe('issues-32-C-12')
  })

  it('{type}/{issue-number}-{title-slug} 패턴', () => {
    const result = buildBranchName(
      '{type}/{issue-number}-{title-slug}',
      { type: 'feature', 'issue-number': '32', 'title-slug': 'add-dark-mode' }
    )
    expect(result).toBe('feature/32-add-dark-mode')
  })

  it('kebab-case 변환: 공백을 하이픈으로', () => {
    const result = buildBranchName(
      '{type}-{title-slug}',
      { type: 'feat', 'title-slug': 'Add Dark Mode' },
      'kebab-case'
    )
    expect(result).toBe('feat-add-dark-mode')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- tests/branch.test.js
```

Expected: FAIL — `Cannot find module '../src/branch.js'`

- [ ] **Step 3: branch.js 구현**

```js
// src/branch.js
export function buildBranchName(pattern, tokens, caseStyle = 'kebab-case') {
  // 빈 토큰과 앞의 구분자(-) 제거: -token이 비어있으면 -token 전체를 제거
  let result = pattern
  for (const [key, value] of Object.entries(tokens)) {
    if (!value) {
      // 해당 토큰과 앞의 구분자 제거 (-, _ 등)
      result = result.replace(new RegExp(`[-_]\\{${key}\\}`), '')
      result = result.replace(new RegExp(`\\{${key}\\}[-_]?`), '')
    } else {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }
  }
  // 잔여 미치환 토큰 제거
  result = result.replace(/\{[^}]+\}/g, '')
  // 중복 구분자 정리
  result = result.replace(/[-_]{2,}/g, '-').replace(/^[-_]|[-_]$/g, '')
  if (caseStyle === 'kebab-case') {
    result = result.replace(/\s+/g, '-').toLowerCase()
  }
  return result
}

export function buildBranchNameFromConfig(config, issueNumber, extra = {}) {
  const tokens = {
    ...config.branch.tokens,
    'issue-number': String(issueNumber),
    ...extra
  }
  return buildBranchName(config.branch.pattern, tokens, config.branch.caseStyle)
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/branch.test.js
```

Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/branch.js tests/branch.test.js
git commit -m "feat: 브랜치 네이밍 패턴 엔진 구현"
```

---

## Phase 2: 셋업 위자드 Skill

### Task 5: 셋업 위자드 스킬 파일 (`skills/setup.md`)

**Files:**
- Create: `skills/setup.md`

- [ ] **Step 1: setup.md 작성**

```markdown
---
name: bylane-setup
description: byLane 하네스 최초 설치 및 설정 위자드. /bylane setup 으로 실행.
---

# byLane Setup Wizard

사용자에게 단계별로 질문하여 `.bylane/bylane.json`을 생성한다.
ALWAYS complete all 6 steps before saving. NEVER skip steps.

## 실행 전 준비

1. `.bylane/` 디렉토리가 없으면 생성:
   ```bash
   mkdir -p .bylane/state
   ```

2. 기존 bylane.json 있으면 현재 설정을 로드해 기본값으로 사용.

## Step 1/6 — 이슈 트래커

사용자에게 묻는다:

> 주 이슈 트래커를 선택하세요:
> 1. GitHub Issues (권장)
> 2. Linear
> 3. 둘 다

- `1` → `trackers.primary = "github"`, `linear.enabled = false`
- `2` → `trackers.primary = "linear"`, Linear API Key 입력 요청
- `3` → `trackers.primary = "both"`, Linear API Key 입력 요청

Linear API Key는 환경변수명(`LINEAR_API_KEY`)으로 저장. 실제 키값은 저장하지 않는다.

## Step 2/6 — 알림 채널

> 완료 알림을 받을 채널을 선택하세요:
> 1. Slack
> 2. Telegram
> 3. 둘 다
> 4. 건너뜀

- Slack 선택 시: 채널명 입력 (예: `#dev-alerts`)
- Telegram 선택 시: Chat ID 입력 방법 안내 후 입력받기
- 건너뜀 → 알림 비활성화

## Step 3/6 — 팀 모드

> 팀 모드를 활성화하시겠습니까? (y/n)

- `y` → 팀원 GitHub 핸들 입력 (쉼표 구분, 예: `@alice, @bob`)
  - 리뷰 할당 방식 질문: `1. round-robin  2. random`
- `n` → `team.enabled = false`

## Step 4/6 — 권한 범위

> Claude가 자동으로 수행할 수 있는 작업 범위를 선택하세요:
> 1. read-only  (분석/리뷰만, 코드 변경 없음)
> 2. write      (코드 작성 + PR 생성, 머지 제외) ← 권장
> 3. full       (머지까지 포함)

`permissions.scope`에 저장.

## Step 5/6 — 고급 설정

> 고급 설정을 변경하시겠습니까? (Enter = 기본값 사용)

각 항목을 순서대로 묻는다. Enter 입력 시 기본값 유지:
- `maxRetries` (기본: 3): 에이전트 재시도 최대 횟수
- `loopTimeoutMinutes` (기본: 30): 루프 타임아웃 (분)
- Figma MCP 활성화? (y/n, 기본: n)

## Step 6/6 — 브랜치 네이밍

> 브랜치 네이밍 패턴을 선택하세요:
> 1. {tracker}-{issue-number}              예) issues-32
> 2. {tracker}-{issue-number}-{custom-id}  예) issues-32-C-12
> 3. {type}/{issue-number}-{title-slug}    예) feature/32-add-dark-mode
> 4. 직접 입력

사전 정의 패턴 선택 시 해당 토큰 기본값 확인:
- `tracker` 기본값: `issues`
- `type` 기본값: `feature`

직접 입력 시 사용 가능한 토큰 목록 안내:
`{tracker}`, `{type}`, `{issue-number}`, `{custom-id}`, `{title-slug}`, `{date}`, `{username}`

## 저장

모든 설정 수집 후:
1. `src/config.js`의 `saveConfig()` 패턴으로 `.bylane/bylane.json` 저장:
   ```bash
   node -e "
   import('./src/config.js').then(({saveConfig}) => {
     saveConfig(CONFIG_OBJECT)
     console.log('✓ .bylane/bylane.json 저장됨')
   })
   "
   ```
2. 설정 요약을 사용자에게 출력한다.
3. `bylane-monitor` 실행 방법 안내: `npm run monitor` 또는 `/bylane monitor`
```

- [ ] **Step 2: setup.md 검토 — 모든 6단계 커버 여부 확인**

각 단계(1~6)가 모두 포함되어 있고, 저장 로직이 명확한지 검토한다. 누락된 항목 없음.

- [ ] **Step 3: Commit**

```bash
git add skills/setup.md
git commit -m "feat: byLane 셋업 위자드 스킬 작성"
```

---

## Phase 3: 에이전트 Skills

### Task 6: 오케스트레이터 스킬 (`skills/orchestrator.md`)

**Files:**
- Create: `skills/orchestrator.md`

- [ ] **Step 1: orchestrator.md 작성**

```markdown
---
name: bylane-orchestrator
description: byLane 메인 오케스트레이터. 자연어 의도를 파싱해 에이전트 파이프라인을 실행한다.
---

# byLane Orchestrator

## 역할

사용자의 자연어 입력을 파싱하여 어떤 에이전트를 어떤 순서로 실행할지 결정한다.

## 실행 전 체크

1. `.bylane/bylane.json` 로드. 없으면 즉시 `bylane-setup` 스킬 실행.
2. `.bylane/state/` 디렉토리 확인. 없으면 생성.

## 의도 파싱 규칙

입력을 분석하여 아래 중 하나로 분류:

| 패턴 | 실행할 에이전트 체인 |
|---|---|
| "구현", "만들어", "추가해", 이슈 없음 | issue-agent → code-agent → test-agent → commit-agent → pr-agent → review-agent → notify-agent |
| "issue #N 구현", "이슈 #N 작업" | issue-agent(분석) → code-agent → test-agent → commit-agent → pr-agent → review-agent → notify-agent |
| "PR #N 리뷰", "리뷰해줘" | review-agent(PR번호 전달) |
| "리뷰 #N 반영", "리뷰 수락" | respond-agent(PR번호, 모드=accept 전달) |
| "리뷰 #N 반박" | respond-agent(PR번호, 모드=rebut 전달) |
| "커밋해줘" | commit-agent |
| "PR 만들어줘" | pr-agent |
| "테스트해줘" | test-agent |

## 에이전트 실행 방법

각 에이전트를 순서대로 Agent 도구로 호출한다. 이전 에이전트의 출력을 다음 에이전트의 입력으로 전달한다.

상태 기록 (각 에이전트 시작 전):
```bash
node -e "
import('./src/state.js').then(({writeState}) => {
  writeState('AGENT_NAME', {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    progress: 0,
    currentTask: 'TASK_DESCRIPTION',
    retries: 0,
    log: []
  })
})
"
```

## 피드백 루프

test-agent가 FAIL을 반환하면:
1. `retries` 값을 읽는다.
2. `retries < config.workflow.maxRetries`이면 code-agent를 재실행 (실패 피드백 포함).
3. `retries >= maxRetries`이면 notify-agent에 "개입 필요" 메시지 전송 후 중단.

respond-agent가 "수정 필요"를 반환하면 동일 로직 적용.

## 완료 처리

모든 에이전트 완료 후:
1. 각 에이전트 state를 `status: "completed"`로 업데이트
2. notify-agent 실행하여 최종 결과 전송
```

- [ ] **Step 2: Commit**

```bash
git add skills/orchestrator.md
git commit -m "feat: 오케스트레이터 스킬 작성"
```

---

### Task 7: 이슈 에이전트 스킬 (`skills/issue-agent.md`)

**Files:**
- Create: `skills/issue-agent.md`

- [ ] **Step 1: issue-agent.md 작성**

```markdown
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
   - `labels`: `bylane-auto` 라벨 추가

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

## 출력: 구현 스펙 JSON

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
      "enabled": true,
      "components": [...],
      "colorTokens": {...}
    }
  }
}
```

## 수동 실행

`/bylane issue #123` 또는 `/bylane issue 다크모드 토글 추가해줘`
```

- [ ] **Step 2: Commit**

```bash
git add skills/issue-agent.md
git commit -m "feat: issue-agent 스킬 작성 (Figma MCP 포함)"
```

---

### Task 8: 코드/테스트/커밋 에이전트 스킬

**Files:**
- Create: `skills/code-agent.md`
- Create: `skills/test-agent.md`
- Create: `skills/commit-agent.md`

- [ ] **Step 1: code-agent.md 작성**

```markdown
---
name: bylane-code-agent
description: issue-agent의 스펙을 기반으로 프론트엔드 코드를 구현한다.
---

# Code Agent

## 입력

`.bylane/state/issue-agent.json`에서 `spec` 읽기. 없으면 사용자에게 스펙 텍스트 직접 입력 요청.

## 실행 흐름

1. 스펙의 `checklist` 항목을 순서대로 구현
2. Figma 스펙이 있으면 (`spec.figmaSpec.enabled === true`):
   - `colorTokens`를 CSS 변수 또는 Tailwind config 값으로 변환
   - 컴포넌트 구조를 Figma 계층에 맞게 구현
3. 기존 코드베이스 패턴 파악 후 동일 스타일로 작성 (TypeScript, 테스트 파일 위치 등)
4. 구현 완료 후 상태 업데이트:
   ```bash
   node -e "import('./src/state.js').then(({writeState})=>writeState('code-agent',{status:'completed',progress:100,changedFiles:CHANGED_FILES_ARRAY}))"
   ```

## 코딩 원칙

- 함수형 컴포넌트 + hooks 우선
- 파일당 단일 책임
- 200줄 초과 시 분리 고려
- 불변성 패턴 유지

## 수동 실행

`/bylane code #123`
```

- [ ] **Step 2: test-agent.md 작성**

```markdown
---
name: bylane-test-agent
description: 변경된 코드의 테스트를 실행하고 결과를 반환한다.
---

# Test Agent

## 입력

`.bylane/state/code-agent.json`의 `changedFiles` 배열

## 실행 흐름

1. 변경 파일 목록 확인
2. 관련 테스트 파일 탐지 (`*.test.ts`, `*.spec.ts`, `*.test.tsx`)
3. 테스트 실행:
   ```bash
   npx vitest run --reporter=verbose 2>&1
   ```
   또는 프로젝트의 테스트 커맨드 사용 (`package.json` → `scripts.test`)

4. 결과 파싱:
   - 모두 통과 → `status: "passed"` 저장 후 commit-agent로 진행
   - 실패 있음 → `status: "failed"`, `failureDetails` 포함 저장 후 orchestrator에 반환

## 출력

`.bylane/state/test-agent.json`:
```json
{
  "agent": "test-agent",
  "status": "passed",
  "totalTests": 12,
  "passed": 12,
  "failed": 0,
  "failureDetails": []
}
```

## 수동 실행

`/bylane test`
```

- [ ] **Step 3: commit-agent.md 작성**

```markdown
---
name: bylane-commit-agent
description: 변경된 파일들을 conventional commit 형식으로 커밋한다.
---

# Commit Agent

## 입력

`.bylane/state/code-agent.json`의 `changedFiles`
`.bylane/state/issue-agent.json`의 `spec.title`, `issueNumber`

## 실행 흐름

1. 브랜치명 생성:
   ```bash
   node -e "
   import('./src/branch.js').then(({buildBranchNameFromConfig}) => {
     import('./src/config.js').then(({loadConfig}) => {
       const config = loadConfig()
       const branch = buildBranchNameFromConfig(config, ISSUE_NUMBER)
       console.log(branch)
     })
   })
   " 
   ```

2. 브랜치 생성 및 체크아웃:
   ```bash
   git checkout -b BRANCH_NAME
   ```

3. 변경 파일 스테이징:
   ```bash
   git add CHANGED_FILES
   ```

4. 커밋 메시지 생성 규칙:
   - `feat: ` + 스펙 제목 (신규 기능)
   - `fix: ` + 스펙 제목 (버그 수정)
   - 본문에 `Closes #ISSUE_NUMBER` 포함

5. 커밋 실행:
   ```bash
   git commit -m "feat: SPEC_TITLE

   Closes #ISSUE_NUMBER"
   ```

## 수동 실행

`/bylane commit`
```

- [ ] **Step 4: Commit**

```bash
git add skills/code-agent.md skills/test-agent.md skills/commit-agent.md
git commit -m "feat: code/test/commit 에이전트 스킬 작성"
```

---

### Task 9: PR/리뷰/응답/알림 에이전트 스킬

**Files:**
- Create: `skills/pr-agent.md`
- Create: `skills/review-agent.md`
- Create: `skills/respond-agent.md`
- Create: `skills/notify-agent.md`

- [ ] **Step 1: pr-agent.md 작성**

```markdown
---
name: bylane-pr-agent
description: 현재 브랜치의 커밋들로 GitHub Pull Request를 생성한다.
---

# PR Agent

## 입력

`.bylane/state/commit-agent.json`의 `branchName`, `commitShas`
`.bylane/state/issue-agent.json`의 `spec.title`, `issueNumber`

## 실행 흐름

1. 원격 브랜치 푸시:
   ```bash
   git push -u origin BRANCH_NAME
   ```

2. PR 제목/본문 생성:
   - 제목: 스펙 제목 (70자 이내)
   - 본문: 변경 요약 + `Closes #ISSUE_NUMBER` + 테스트 체크리스트

3. GitHub MCP로 PR 생성:
   - `title`: 생성된 제목
   - `body`: 생성된 본문
   - `head`: 현재 브랜치
   - `base`: main (또는 config 기본 브랜치)
   - `draft`: false

4. `.bylane/state/pr-agent.json`에 PR URL, PR 번호 저장

## 수동 실행

`/bylane pr`
```

- [ ] **Step 2: review-agent.md 작성**

```markdown
---
name: bylane-review-agent
description: PR의 diff를 분석하여 코드 리뷰 코멘트를 작성한다.
---

# Review Agent

## 입력

PR 번호 (`.bylane/state/pr-agent.json`에서 자동 로드, 또는 수동 전달)

## 실행 흐름

1. GitHub MCP로 PR diff 로드
2. 변경된 파일별 분석:
   - 버그 가능성
   - 타입 오류
   - 성능 이슈
   - 코딩 컨벤션 위반
   - 테스트 커버리지 누락
3. 리뷰 코멘트 작성 기준:
   - CRITICAL: 즉시 수정 필요
   - HIGH: 수정 강력 권장
   - MEDIUM: 개선 권장
   - LOW: 선택적 개선
4. GitHub MCP로 리뷰 제출 (approve / request_changes / comment)
5. CRITICAL/HIGH 없으면 → `approved: true`
   CRITICAL/HIGH 있으면 → `approved: false`, 코멘트 목록 포함

## 수동 실행

`/bylane review #45`
```

- [ ] **Step 3: respond-agent.md 작성**

```markdown
---
name: bylane-respond-agent
description: PR 리뷰 코멘트에 반박하거나 코드를 수정하여 반영한다.
---

# Respond Agent

## 입력

- PR 번호
- 모드: `accept` (반영) 또는 `rebut` (반박)

## 실행 흐름

### accept 모드

1. GitHub MCP로 미해결 리뷰 코멘트 로드
2. 각 코멘트별 수정 사항 결정
3. code-agent를 서브 에이전트로 호출하여 수정 구현
4. test-agent로 검증
5. commit-agent로 수정 커밋
6. GitHub MCP로 각 코멘트에 "반영 완료" 답글 작성

### rebut 모드

1. GitHub MCP로 미해결 리뷰 코멘트 로드
2. 각 코멘트에 대해 기존 구현의 근거를 기술한 반박 답글 작성
3. 반박 근거:
   - 의도적 설계 결정인 경우 배경 설명
   - 성능 트레이드오프가 있는 경우 수치 근거 제시
   - 스펙 요구사항과 일치하는 경우 이슈 링크 첨부

## 수동 실행

`/bylane respond #45` → accept/rebut 선택 프롬프트 표시
```

- [ ] **Step 4: notify-agent.md 작성**

```markdown
---
name: bylane-notify-agent
description: 워크플로우 완료 또는 개입 필요 시 Slack/Telegram으로 알림을 보낸다.
---

# Notify Agent

## 입력

- `type`: `completed` | `escalated` | `error`
- `summary`: 결과 요약 텍스트
- `url`: 관련 GitHub URL (PR, Issue 등)

## 실행 흐름

`.bylane/bylane.json`에서 알림 설정 로드:

### Slack 알림 (enabled: true)

Slack MCP `slack_send_message` 도구 사용:
- 채널: `config.notifications.slack.channel`
- 메시지 형식:
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

### Telegram 알림 (enabled: true)

Telegram MCP 또는 Telegram Bot API (curl):
```bash
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$TELEGRAM_CHAT_ID&text=MESSAGE&parse_mode=Markdown"
```

### 터미널 출력 (항상)

알림 채널 설정 여부와 무관하게 Claude Code 터미널에 결과 출력.

## 수동 실행

`/bylane notify` → 가장 최근 워크플로우 결과로 알림 발송
```

- [ ] **Step 5: Commit**

```bash
git add skills/pr-agent.md skills/review-agent.md skills/respond-agent.md skills/notify-agent.md
git commit -m "feat: pr/review/respond/notify 에이전트 스킬 작성"
```

---

## Phase 4: 모니터 TUI 대시보드

### Task 10: blessed 레이아웃 기반 TUI (`src/monitor/`)

**Files:**
- Create: `src/monitor/panels/header.js`
- Create: `src/monitor/panels/pipeline.js`
- Create: `src/monitor/panels/log.js`
- Create: `src/monitor/panels/queue.js`
- Create: `src/monitor/panels/status.js`
- Create: `src/monitor/layout.js`
- Create: `src/monitor/poller.js`
- Create: `src/monitor/index.js`

- [ ] **Step 1: header.js 작성**

```js
// src/monitor/panels/header.js
import blessed from 'blessed'

export function createHeader(screen) {
  const box = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    content: ' byLane Monitor   Idle   --:--:--',
    tags: true,
    border: { type: 'line' },
    style: { fg: 'white', bg: 'blue', border: { fg: 'cyan' } }
  })
  screen.append(box)

  return {
    update({ workflowTitle, elapsed, time }) {
      const title = workflowTitle ?? 'Idle'
      box.setContent(` {bold}byLane Monitor{/bold}   ${title}   ${elapsed ?? ''}  ${time}`)
      screen.render()
    }
  }
}
```

- [ ] **Step 2: pipeline.js 작성**

```js
// src/monitor/panels/pipeline.js
import blessed from 'blessed'

const AGENTS = [
  'orchestrator', 'issue-agent', 'code-agent', 'test-agent',
  'commit-agent', 'pr-agent', 'review-agent', 'respond-agent', 'notify-agent'
]

const STATUS_ICON = {
  idle:        '[○]',
  in_progress: '[▶]',
  completed:   '[✓]',
  failed:      '[✗]',
  escalated:   '[!]'
}

export function createPipelinePanel(screen) {
  const box = blessed.box({
    top: 3,
    left: 0,
    width: '50%',
    height: '60%-3',
    label: ' AGENT PIPELINE ',
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } }
  })
  screen.append(box)

  return {
    update(states) {
      const lines = AGENTS.map(name => {
        const s = states[name]
        if (!s) return ` ${STATUS_ICON.idle} ${name.padEnd(16)} 대기`
        const icon = STATUS_ICON[s.status] ?? STATUS_ICON.idle
        const elapsed = s.startedAt
          ? `${Math.floor((Date.now() - new Date(s.startedAt)) / 1000)}s`
          : ''
        const bar = s.progress > 0
          ? `${'█'.repeat(Math.floor(s.progress / 10))}${'░'.repeat(10 - Math.floor(s.progress / 10))} ${s.progress}%`
          : ''
        return ` ${icon} ${name.padEnd(16)} ${elapsed.padEnd(6)} ${bar}`
      })
      const retries = states['orchestrator']?.retries ?? 0
      const maxRetries = states['orchestrator']?.maxRetries ?? 3
      lines.push('', ` Retries: ${retries}/${maxRetries}`)
      box.setContent(lines.join('\n'))
      screen.render()
    }
  }
}
```

- [ ] **Step 3: log.js 작성**

```js
// src/monitor/panels/log.js
import blessed from 'blessed'

export function createLogPanel(screen) {
  const box = blessed.box({
    top: 3,
    left: '50%',
    width: '50%',
    height: '60%-3',
    label: ' AGENT LOG  [LIVE] ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } },
    keys: true,
    vi: true
  })
  screen.append(box)
  const lines = []

  return {
    update(states) {
      const newLines = []
      for (const state of Object.values(states)) {
        for (const entry of (state.log ?? []).slice(-5)) {
          const ts = new Date(entry.ts).toLocaleTimeString('ko-KR', { hour12: false })
          newLines.push(` ${ts} {cyan-fg}${state.agent}{/cyan-fg}`)
          newLines.push(`   → ${entry.msg}`)
        }
      }
      // 최근 50줄만 유지
      const all = [...lines, ...newLines].slice(-50)
      lines.length = 0
      lines.push(...all)
      box.setContent(lines.join('\n'))
      box.scrollTo(lines.length)
      screen.render()
    }
  }
}
```

- [ ] **Step 4: queue.js 작성**

```js
// src/monitor/panels/queue.js
import blessed from 'blessed'
import { existsSync, readFileSync } from 'fs'

export function createQueuePanel(screen) {
  const box = blessed.box({
    top: '60%',
    left: 0,
    width: '50%',
    height: '40%',
    label: ' QUEUE ',
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } }
  })
  screen.append(box)

  return {
    update() {
      const queuePath = '.bylane/queue.json'
      const queue = existsSync(queuePath)
        ? JSON.parse(readFileSync(queuePath, 'utf8'))
        : []
      const header = ` ${'#'.padEnd(3)} ${'TYPE'.padEnd(12)} ${'TARGET'.padEnd(10)} STATUS`
      const rows = queue.slice(0, 8).map((item, i) =>
        ` ${String(i + 1).padEnd(3)} ${item.type.padEnd(12)} ${item.target.padEnd(10)} ${item.status}`
      )
      box.setContent([header, ...rows].join('\n'))
      screen.render()
    }
  }
}
```

- [ ] **Step 5: status.js 작성**

```js
// src/monitor/panels/status.js
import blessed from 'blessed'
import { loadConfig } from '../../config.js'

export function createStatusPanel(screen) {
  const box = blessed.box({
    top: '60%',
    left: '50%',
    width: '50%',
    height: '40%',
    label: ' SYSTEM STATUS ',
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } }
  })
  screen.append(box)

  return {
    update() {
      const config = loadConfig()
      const check = (v) => v ? '{green-fg}✓{/green-fg}' : '{red-fg}✗{/red-fg}'
      const lines = [
        ` GitHub      ${check(true)} 연결됨`,
        ` Linear      ${check(config.trackers.linear.enabled)} ${config.trackers.linear.enabled ? '활성' : '비활성'}`,
        ` Figma MCP   ${check(config.extensions.figma.enabled)} ${config.extensions.figma.enabled ? '활성' : '비활성'}`,
        ` Slack       ${check(config.notifications.slack.enabled)} ${config.notifications.slack.channel || '미설정'}`,
        ` Telegram    ${check(config.notifications.telegram.enabled)} ${config.notifications.telegram.chatId || '미설정'}`,
        ``,
        ` 팀 모드     ${check(config.team.enabled)} ${config.team.enabled ? `활성 (${config.team.members.length}명)` : '비활성'}`,
        ` 권한 범위   ${config.permissions.scope}`
      ]
      box.setContent(lines.join('\n'))
      screen.render()
    }
  }
}
```

- [ ] **Step 6: poller.js 작성**

```js
// src/monitor/poller.js
import { watch } from 'chokidar'
import { listStates } from '../state.js'

export function createPoller(stateDir = '.bylane/state', intervalMs = 1000) {
  const callbacks = new Set()

  const emit = () => {
    const states = {}
    for (const s of listStates(stateDir)) {
      states[s.agent] = s
    }
    for (const cb of callbacks) cb(states)
  }

  const watcher = watch(`${stateDir}/*.json`, { persistent: true })
  watcher.on('change', emit)
  watcher.on('add', emit)

  // 폴백 인터벌
  const interval = setInterval(emit, intervalMs)

  return {
    onChange(cb) { callbacks.add(cb) },
    stop() {
      clearInterval(interval)
      watcher.close()
    }
  }
}
```

- [ ] **Step 7: layout.js + index.js 작성**

```js
// src/monitor/layout.js
import blessed from 'blessed'
import { createHeader } from './panels/header.js'
import { createPipelinePanel } from './panels/pipeline.js'
import { createLogPanel } from './panels/log.js'
import { createQueuePanel } from './panels/queue.js'
import { createStatusPanel } from './panels/status.js'

export function createLayout() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'byLane Monitor'
  })

  const header = createHeader(screen)
  const pipeline = createPipelinePanel(screen)
  const log = createLogPanel(screen)
  const queue = createQueuePanel(screen)
  const status = createStatusPanel(screen)

  // 푸터
  const footer = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' [q]종료  [p]일시정지  [c]작업취소  [Tab]포커스  [↑↓]로그스크롤  [?]도움말',
    style: { fg: 'black', bg: 'cyan' }
  })
  screen.append(footer)

  screen.key(['q', 'C-c'], () => process.exit(0))

  return { screen, header, pipeline, log, queue, status }
}
```

```js
// src/monitor/index.js
#!/usr/bin/env node
import { createLayout } from './layout.js'
import { createPoller } from './poller.js'

const { screen, header, pipeline, log, queue, status } = createLayout()
const poller = createPoller()

let startTime = Date.now()
const clockInterval = setInterval(() => {
  header.update({
    time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
    elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
  })
}, 1000)

poller.onChange((states) => {
  pipeline.update(states)
  log.update(states)
  queue.update()
  status.update()
})

screen.render()
```

- [ ] **Step 8: bin 권한 설정**

```bash
chmod +x src/monitor/index.js
```

- [ ] **Step 9: 모니터 실행 테스트**

```bash
# 테스트용 더미 상태 파일 생성
mkdir -p .bylane/state
node -e "
import('./src/state.js').then(({writeState}) => {
  writeState('code-agent', { status: 'in_progress', progress: 67, currentTask: 'ThemeToggle.tsx 구현', retries: 0 })
  writeState('issue-agent', { status: 'completed', progress: 100, retries: 0 })
})
"
npm run monitor
```

Expected: 2열 TUI 대시보드 표시, `q` 로 종료

- [ ] **Step 10: Commit**

```bash
git add src/monitor/ 
git commit -m "feat: blessed 기반 TUI 모니터 대시보드 구현"
```

---

## Phase 5: Hooks + Commands + CLAUDE.md

### Task 11: Hooks 및 Commands 파일 작성

**Files:**
- Create: `hooks/post-tool-use.md`
- Create: `commands/bylane.md`
- Create: `commands/bylane-monitor.md`
- Create: `CLAUDE.md`

- [ ] **Step 1: hooks/post-tool-use.md 작성**

```markdown
---
name: bylane-post-tool-use
description: GitHub 이벤트 감지 후 적절한 byLane 에이전트를 자동 트리거한다.
trigger: post-tool-use
---

# byLane External Event Hook

GitHub MCP 도구 사용 후 결과를 분석하여 자동으로 에이전트를 트리거한다.

## 감지 규칙

### PR 오픈 감지

GitHub MCP `create_pull_request` 또는 `list_pull_requests` 결과에서
`state: "open"` + `user.login`이 팀 멤버인 PR 발견 시:

→ `.bylane/bylane.json`의 `team.enabled`가 `true`이면 `bylane-review-agent` 실행

### 리뷰 코멘트 수신 감지

GitHub MCP 결과에서 내 PR에 `review_state: "changes_requested"` 발견 시:

→ `bylane-respond-agent` 실행 (PR 번호 전달)

### CI 실패 감지

GitHub MCP `get_pull_request_status`에서 `state: "failure"` 발견 시:

→ `.bylane/state/code-agent.json`의 retries 확인
→ `retries < maxRetries`이면 `bylane-code-agent` 재실행

## 비활성화

`.bylane/bylane.json`에 `"hookAutoTrigger": false` 추가 시 이 hook 비활성화
```

- [ ] **Step 2: commands/bylane.md 작성**

```markdown
---
name: bylane
description: byLane 메인 커맨드. 자연어로 전체 개발 워크플로우를 실행한다.
---

# /bylane

## 사용법

```
/bylane [자연어 명령]
/bylane setup
/bylane monitor
/bylane issue [#번호 | 텍스트]
/bylane code [#번호]
/bylane test
/bylane commit
/bylane pr
/bylane review [PR번호]
/bylane respond [PR번호]
/bylane notify
/bylane status
```

## 실행 흐름

1. 인자가 없거나 자연어이면 → `bylane-orchestrator` 스킬 실행
2. 첫 번째 단어가 서브커맨드이면 → 해당 스킬 직접 실행:
   - `setup` → `bylane-setup`
   - `monitor` → 아래 참조
   - `issue` → `bylane-issue-agent`
   - `code` → `bylane-code-agent`
   - `test` → `bylane-test-agent`
   - `commit` → `bylane-commit-agent`
   - `pr` → `bylane-pr-agent`
   - `review` → `bylane-review-agent`
   - `respond` → `bylane-respond-agent`
   - `notify` → `bylane-notify-agent`
   - `status` → `.bylane/state/` 파일 읽어 한 줄 요약 출력

## monitor 서브커맨드

```bash
npm run monitor --prefix $(find ~/.claude -name "bylane" -type d | head -1)
```
또는 `bylane-monitor` bin이 PATH에 있으면:
```bash
bylane-monitor
```
```

- [ ] **Step 3: commands/bylane-monitor.md 작성**

```markdown
---
name: bylane-monitor
description: byLane 실시간 TUI 모니터 대시보드를 실행한다.
---

# /bylane monitor

## 설명

현재 진행 중인 모든 byLane 에이전트의 상태를 2열 그리드 TUI로 실시간 표시.

## 실행

```bash
node src/monitor/index.js
```

`npm run monitor`로도 실행 가능.

## 키보드 단축키

| 키 | 동작 |
|---|---|
| `q` / `Ctrl+C` | 종료 |
| `p` | 현재 에이전트 일시정지 |
| `c` | 현재 작업 취소 |
| `Tab` | 패널 포커스 전환 |
| `↑` / `↓` | 로그 패널 스크롤 |
| `?` | 도움말 |
```

- [ ] **Step 4: CLAUDE.md 작성**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

byLane — Claude Code용 프론트엔드 개발 자동화 하네스.
오케스트레이터 + 워커 에이전트 패턴으로 이슈 생성부터 PR 머지까지 자동화.

## 커맨드

```bash
# 의존성 설치
npm install

# 테스트 실행
npm test

# 모니터 대시보드 실행
npm run monitor

# 테스트 더미 데이터 생성
node -e "import('./src/state.js').then(({writeState})=>writeState('code-agent',{status:'in_progress',progress:50}))"
```

## 아키텍처

- `src/state.js` — `.bylane/state/*.json` 읽기/쓰기 유틸
- `src/config.js` — `.bylane/bylane.json` 로드/저장/검증
- `src/branch.js` — 브랜치명 패턴 엔진 (`{tracker}-{issue-number}-{custom-id}` 등)
- `src/monitor/` — blessed 기반 TUI 대시보드 (2열 그리드)
- `skills/` — Claude Code 에이전트 skill 파일들 (Markdown)
- `hooks/` — 외부 이벤트 자동 감지 훅
- `commands/` — `/bylane` 슬래시 커맨드 정의

## 에이전트 파이프라인

orchestrator → issue-agent → code-agent → test-agent → commit-agent → pr-agent → review-agent → respond-agent → notify-agent

각 에이전트는 `.bylane/state/{name}.json`에 상태 기록.
모니터 대시보드가 1초마다 폴링하여 표시.

## 상태 파일 스키마

```json
{
  "agent": "code-agent",
  "status": "in_progress | completed | failed | idle",
  "startedAt": "ISO8601",
  "progress": 0-100,
  "retries": 0,
  "log": [{ "ts": "ISO8601", "msg": "string" }]
}
```

## 브랜치 네이밍 토큰

`{tracker}`, `{type}`, `{issue-number}`, `{custom-id}`, `{title-slug}`, `{date}`, `{username}`
빈 토큰은 자동으로 제외됨 (e.g. `{custom-id}` 없으면 `issues-32-C-12` → `issues-32`)
```

- [ ] **Step 5: Commit**

```bash
git add hooks/ commands/ CLAUDE.md
git commit -m "feat: hooks, commands, CLAUDE.md 작성"
```

---

### Task 12: 전체 테스트 실행 및 최종 커밋

**Files:**
- 없음 (검증 단계)

- [ ] **Step 1: 전체 테스트 실행**

```bash
npm test
```

Expected:
```
✓ tests/state.test.js (5 tests)
✓ tests/config.test.js (6 tests)
✓ tests/branch.test.js (5 tests)

Test Files  3 passed (3)
Tests       16 passed (16)
```

- [ ] **Step 2: 모니터 스모크 테스트**

```bash
node -e "
import('./src/state.js').then(({writeState}) => {
  writeState('issue-agent', { status: 'completed', progress: 100, retries: 0, log: [{ts: new Date().toISOString(), msg: 'spec.json 저장됨'}] })
  writeState('code-agent', { status: 'in_progress', progress: 67, retries: 1, log: [{ts: new Date().toISOString(), msg: 'ThemeToggle.tsx 구현 중'}] })
  console.log('더미 상태 생성됨')
})
"
npm run monitor
```

Expected: TUI 대시보드 표시, 2개 에이전트 상태 표시, `q` 로 종료

- [ ] **Step 3: skills 디렉토리 파일 수 확인**

```bash
ls skills/ | wc -l
```

Expected: `10` (orchestrator + setup + 8 agents)

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git status  # 누락 파일 없는지 확인
git commit -m "chore: byLane 1.0 초기 구현 완료"
```

---

## 설치 방법 (사용자 가이드)

이 레포지토리를 Claude Code 프로젝트에 하네스로 연결하는 방법:

```bash
# 1. byLane 클론
git clone https://github.com/YOUR/byLane ~/.claude/plugins/bylane

# 2. 의존성 설치
cd ~/.claude/plugins/bylane && npm install

# 3. Claude Code 설정에 스킬/커맨드 경로 등록
# ~/.claude/settings.json 에 skills, hooks, commands 경로 추가

# 4. 프론트엔드 프로젝트에서 셋업 실행
/bylane setup
```
