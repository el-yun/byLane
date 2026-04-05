#!/bin/bash
set -e

echo "byLane 릴리즈 시작..."

# 작업 디렉토리 클린 확인
if [ -n "$(git status --short)" ]; then
  echo "오류: 커밋되지 않은 변경사항이 있습니다. 먼저 커밋하세요."
  git status --short
  exit 1
fi

# 테스트 실행
echo "테스트 실행 중..."
npm test

# 마이너 버전 올리기 (package.json 수정 + git tag)
echo "버전 올리는 중..."
NEW_VERSION=$(npm version minor --no-git-tag-version)
echo "새 버전: $NEW_VERSION"

# package-lock.json 업데이트
npm install --package-lock-only 2>/dev/null || true

# 커밋 + 태그
git add package.json package-lock.json
git commit -m "chore: release $NEW_VERSION"
git tag "$NEW_VERSION"

# GitHub 푸시
echo "GitHub 푸시 중..."
git push origin main --tags

# npm 배포 (2FA 필요 시 프롬프트)
echo "npm 배포 중... (2FA 코드가 필요할 수 있습니다)"
npm publish --access public

echo ""
echo "릴리즈 완료: $NEW_VERSION"
echo "https://www.npmjs.com/package/@elyun/bylane"
