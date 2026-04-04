---
name: bylane-pr-agent
description: 현재 브랜치의 커밋들로 GitHub Pull Request를 생성한다.
---

# PR Agent

## 입력

- `.bylane/state/commit-agent.json`의 `branchName`, `commitSha`
- `.bylane/state/issue-agent.json`의 `spec.title`, `issueNumber`

## 실행 전 상태 기록

```bash
node -e "import('./src/state.js').then(({writeState})=>writeState('pr-agent',{status:'in_progress',startedAt:new Date().toISOString(),progress:0,retries:0,log:[]}))"
```

## 실행 흐름

1. 원격 브랜치 푸시:
   ```bash
   git push -u origin BRANCH_NAME
   ```

2. PR 제목/본문 생성:
   - 제목: 스펙 제목 (70자 이내)
   - 본문:
     ```
     ## Summary
     - [변경 요약]

     ## Test Plan
     - [ ] 변경된 기능 동작 확인
     - [ ] 기존 테스트 통과 확인

     Closes #ISSUE_NUMBER
     ```

3. GitHub MCP로 PR 생성:
   - `title`: 생성된 제목
   - `body`: 생성된 본문
   - `head`: 현재 브랜치명
   - `base`: main

4. 상태 업데이트:
   ```bash
   node -e "
   import('./src/state.js').then(({writeState})=>writeState('pr-agent',{
     status:'completed',
     progress:100,
     prNumber:'PR_NUMBER',
     prUrl:'PR_URL'
   }))
   "
   ```

## 출력

`.bylane/state/pr-agent.json`:
```json
{
  "agent": "pr-agent",
  "status": "completed",
  "progress": 100,
  "prNumber": 45,
  "prUrl": "https://github.com/owner/repo/pull/45"
}
```

## 수동 실행

`/bylane pr`
