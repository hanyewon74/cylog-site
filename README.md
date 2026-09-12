# 사이로그 (cylog)

우리 사이를 기억하는 AI — 인간관계 코파일럿 앱

## 로컬에서 실행하기

```
npm install
npm run dev
```

AI 기능을 로컬에서도 쓰려면 `.env.example`을 `.env`로 복사하고
`ANTHROPIC_API_KEY`에 본인의 Anthropic API 키를 넣어주세요.

## 배포하기

GitHub + Vercel로 배포하는 방법은 대화에서 안내받은 순서를 따라 하시면 됩니다.
핵심만 요약하면:

1. 이 폴더를 GitHub 저장소에 올린다
2. Vercel에서 그 저장소를 Import 한다
3. Vercel 프로젝트 설정 > Environment Variables 에 `ANTHROPIC_API_KEY`를 추가한다
4. Deploy 버튼을 누른다
