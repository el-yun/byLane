---
name: bylane-commit-agent
description: 변경된 파일들을 conventional commit 형식으로 커밋한다.
---

# Commit Agent

## 입력

- `.bylane/state/code-agent.json`의 `changedFiles`
- `.bylane/state/issue-agent.json`의 `spec.title`, `issueNumber`
- `.bylane/bylane.json`의 `branch` 설정

## 실행 전 상태 기록

```bash
node -e "import('./src/state.js').then(({writeState})=>writeState('commit-agent',{status:'in_progress',startedAt:new Date().toISOString(),progress:0,retries:0,log:[]}))"
```

## 실행 흐름

1. 브랜치명 생성:
   ```bash
   node -e "
   Promise.all([
     import('./src/branch.js'),
     import('./src/config.js')
   ]).then(([{buildBranchNameFromConfig},{loadConfig}]) => {
     const config = loadConfig()
     const branch = buildBranchNameFromConfig(config, ISSUE_NUMBER)
     console.log(branch)
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

4. 커밋 타입 결정:
   - 새 기능: `feat:`
   - 버그 수정: `fix:`
   - 리팩토링: `refactor:`

5. 커밋 실행:
   ```bash
   git commit -m "feat: SPEC_TITLE

   Closes #ISSUE_NUMBER"
   ```

6. 상태 업데이트:
   ```bash
   node -e "
   import('./src/state.js').then(({writeState})=>writeState('commit-agent',{
     status:'completed',
     progress:100,
     branchName:'BRANCH_NAME',
     commitSha:'COMMIT_SHA'
   }))
   "
   ```

## 출력

`.bylane/state/commit-agent.json`:
```json
{
  "agent": "commit-agent",
  "status": "completed",
  "progress": 100,
  "branchName": "issues-123-add-dark-mode",
  "commitSha": "abc1234"
}
```

## 수동 실행

`/bylane commit`
