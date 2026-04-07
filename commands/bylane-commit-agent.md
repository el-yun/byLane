---
name: bylane-commit-agent
description: 변경된 파일들을 분석하여 conventional commit(feat/fix/refactor 등) 형식의 메시지를 자동 생성하고 커밋한다. 시크릿 파일은 자동 제외.
---

# Commit Agent

## 입력

- `.bylane/state/code-agent.json`의 `changedFiles`
- `.bylane/state/issue-agent.json`의 `spec.title`, `issueNumber`
- `.bylane/bylane.json`의 `branch` 설정

## 실행 전 상태 기록

```bash
npx @elyun/bylane state write commit-agent '{"status":"in_progress","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","progress":0,"retries":0,"log":[]}'
```

## GitHub 커밋 템플릿 탐지

커밋 메시지 작성 전 아래 순서로 템플릿을 탐색한다:

```bash
# 1. git commit.template 설정 확인
git config commit.template 2>/dev/null

# 2. 일반적인 위치
ls .gitmessage .github/commit-template.txt .github/COMMIT_TEMPLATE.md 2>/dev/null | head -1
```

템플릿이 있으면 해당 형식을 **반드시** 따른다.
없으면 conventional commit 형식(`feat:`, `fix:` 등)을 사용한다.

## 실행 흐름

1. 브랜치명 생성:
   ```bash
   npx @elyun/bylane branch ISSUE_NUMBER
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
   npx @elyun/bylane state write commit-agent '{"status":"completed","progress":100,"branchName":"BRANCH_NAME","commitSha":"COMMIT_SHA"}'
   ```

## Slack 완료 알림

`.bylane/bylane.json`의 `notifications.slack.enabled: true`이고 `webhookUrl`이 있으면 전송:

```bash
SLACK_WEBHOOK_URL=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('.bylane/bylane.json','utf8'));const s=c.notifications?.slack;process.stdout.write(s?.enabled&&s?.webhookUrl?s.webhookUrl:'')}catch(e){}" 2>/dev/null)

[ -n "$SLACK_WEBHOOK_URL" ] && curl -s -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"[commit-agent] 커밋 완료 (BRANCH_NAME)\",
    \"status\": \"completed\",
    \"url\": \"\",
    \"elapsed\": \"ELAPSED\",
    \"reason\": \"\"
  }"
```

---

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
