# 리뷰 템플릿

이 파일을 복사해 프로젝트별로 커스터마이즈하세요.
`.bylane/bylane.json`의 `review.templateFile`에 경로를 지정하면 적용됩니다.

---

## 인라인 코멘트 형식

각 리뷰 코멘트는 **해당 코드 라인에 직접** 작성합니다.

```
{title}

{description}

{suggestion_block}
```

### 필드 설명

- `{title}` — 문제 제목 (한 줄, 간결하게)
- `{description}` — 문제 설명 및 이유
- `{suggestion_block}` — GitHub suggestion 블록 (수정 제안 코드)

### suggestion 블록 형식

````
```suggestion
// 수정된 코드 (원본 라인을 그대로 대체)
```
````

GitHub에서 "Apply suggestion" 버튼으로 바로 적용 가능합니다.

---

## 전체 요약 형식 (PR 전체 코멘트)

```
## 리뷰 요약

### 주요 발견사항
- ...

### 종합 의견
...
```

---

## 푸터

기본값: `{model} · {date}`

`{model}`, `{date}` — 실제 모델명과 날짜로 자동 치환됩니다.
