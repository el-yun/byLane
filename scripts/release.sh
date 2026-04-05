#!/bin/bash
set -e

FORCE_RELEASE=false
for arg in "$@"; do
  [ "$arg" = "--force-release" ] && FORCE_RELEASE=true
done

echo "byLane 릴리즈 시작..."

# 작업 디렉토리 클린 확인 (--force-release 시 건너뜀)
if [ "$FORCE_RELEASE" = false ] && [ -n "$(git status --short)" ]; then
  echo "오류: 커밋되지 않은 변경사항이 있습니다. 먼저 커밋하거나 --force-release 를 사용하세요."
  git status --short
  exit 1
fi

# 테스트 실행
echo "테스트 실행 중..."
npm test

if [ "$FORCE_RELEASE" = true ]; then
  # 현재 package.json 버전 그대로 사용
  NEW_VERSION="v$(node -p "require('./package.json').version")"
  echo "현재 버전으로 배포: $NEW_VERSION"

  # 태그가 없으면 생성
  if ! git tag | grep -q "^$NEW_VERSION$"; then
    git tag "$NEW_VERSION"
    git push origin "$NEW_VERSION"
    echo "태그 생성: $NEW_VERSION"
  else
    echo "태그 이미 존재: $NEW_VERSION"
  fi
else
  # 마이너 버전 올리기
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
fi

# npm 배포 (2FA 필요 시 프롬프트)
echo "npm 배포 중... (2FA 코드가 필요할 수 있습니다)"
npm publish --access public

echo ""
echo "릴리즈 완료: $NEW_VERSION"
echo "https://www.npmjs.com/package/@elyun/bylane"
