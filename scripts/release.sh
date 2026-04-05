#!/bin/bash
set -e

VERSION="v$(node -p "require('./package.json').version")"

echo "byLane npm 배포 시작: $VERSION"

# 작업 디렉토리 클린 확인
if [ -n "$(git status --short)" ]; then
  echo "오류: 커밋되지 않은 변경사항이 있습니다. 먼저 커밋하고 푸시하세요."
  git status --short
  exit 1
fi

# 테스트 실행
echo "테스트 실행 중..."
npm test

# npm 배포 (2FA 필요 시 프롬프트)
echo "npm 배포 중... (2FA 코드가 필요할 수 있습니다)"
npm publish --access public

echo ""
echo "배포 완료: $VERSION"
echo "https://www.npmjs.com/package/@elyun/bylane"
