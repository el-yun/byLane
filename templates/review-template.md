# byLane 리뷰 템플릿

이 파일을 복사해 프로젝트별로 커스터마이즈하세요.
`.bylane/bylane.json`의 `review.templateFile`에 경로를 지정하면 적용됩니다.

---

## 코멘트 형식

각 리뷰 코멘트는 아래 형식을 따릅니다:

```
{severity} {title}

{description}

{code_example}

{suggestion}
```

### 필드 설명

- `{severity}` — 심각도 레이블 (`[CRITICAL]` / `[HIGH]` / `[MEDIUM]` / `[LOW]`)
- `{title}` — 문제 제목 (한 줄)
- `{description}` — 문제 설명 및 이유
- `{code_example}` — 문제가 있는 코드 예시 (선택, `review.includeCodeExample: false`로 비활성)
- `{suggestion}` — 수정 방법 또는 개선 예시 코드

---

## 심각도 기준

| 심각도 | 기준 | 처리 |
|--------|------|------|
| CRITICAL | 버그, 보안 취약점, 데이터 손실 가능성 | 즉시 수정 필요, PR 차단 |
| HIGH | 잘못된 로직, 성능 심각 저하 | 수정 강력 권장 |
| MEDIUM | 코드 품질, 가독성, 테스트 누락 | 개선 권장 |
| LOW | 네이밍, 스타일, 선택적 개선 | 참고용 |

---

## 코드 예시 형식

**Before (문제 코드):**
```language
// 문제가 있는 코드
```

**After (수정 제안):**
```language
// 개선된 코드
```

---

## 전체 리뷰 요약 형식

```
## 코드 리뷰 요약

| 심각도 | 건수 |
|--------|------|
| CRITICAL | N |
| HIGH | N |
| MEDIUM | N |
| LOW | N |

### 주요 발견사항
- ...

### 종합 의견
...

---
{footer}
```

---

## 푸터

기본값: `Reviewed by byLane · model: {model}`

`{model}` — 실제 사용된 모델명으로 자동 치환됩니다.
커스터마이즈 예시: `AI 리뷰 by byLane (claude-sonnet-4-6) · {date}`
