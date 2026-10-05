# fairplay-fe

Fairplay의 React · Vite 웹 프론트엔드입니다. [화면 구성·기능 정리](https://app.notion.com/p/3ef21f76795a812d9d5dea3554bf2d7e)와 fairplay-be main의 구현 계약을 기준으로 연결합니다.

## 실행

Node.js 22 이상과 npm을 사용합니다.

```bash
npm ci
cp .env.example .env
npm run dev
```

기존 `.env`가 있으면 필요한 값만 수정합니다. `VITE_GOOGLE_CLIENT_ID`는 웹용 Google OAuth 클라이언트 ID이며, 프론트에 비밀키를 저장하지 않습니다. 실제 로그인은 Google Identity Services 팝업에서 받은 코드를 `POST /api/auth/google`에 전달합니다. Google 설정에 사용 중인 프론트 origin을 등록하고 백엔드 origin·쿠키 설정도 일치시켜야 합니다.

`VITE_API_BASE_URL`을 비우면 같은 origin의 `/api`를 사용합니다. 로컬 Vite 프록시와 Vercel rewrite의 기존 대상은 `http://52.78.77.186:8080`입니다. 다른 서버를 사용할 경우 `vite.config.js`와 `vercel.json`의 프록시 대상을 조정합니다. 백엔드에 직접 요청할 때는 `VITE_API_BASE_URL`에 origin을 지정하고 백엔드 CORS·쿠키 설정을 함께 확인합니다. 환경 변수를 바꾼 후 개발 서버를 재시작하거나 배포 빌드를 다시 생성합니다.

샘플 계정, 인증 우회, API mock 모드는 없습니다. 이전 `VITE_AUTH_BYPASS`와 `VITE_*_API_MODE` 설정은 사용하지 않습니다.

## 구현 범위

- 로그인·세션 확인·로그아웃, 쿠키 인증과 CSRF 처리
- 스페이스 생성·코드 참여, 생성 후 팀 빌딩 기간 지정, 참여 코드 조회·발급·재발급·철회
- 팀 생성·가입 신청, 리더의 승인·반려 및 부리더 지정·해제
- 작업 보드·생성·수정·삭제, 담당 배분과 필수 승인자 선택, 개인 수행 설명
- TEXT·URL·FILE 산출물 등록·수정·제거, 파일 업로드·교체·인증 다운로드
- 완료 요청, 지정 승인자의 승인·반려, 요청 이력

팀 홈은 팀 기본 정보와 작업 진입을 제공합니다. AI 평가, 동료 평가, 기여도 리포트, 본인 기여도 집계, 관리자 대시보드 집계, 팀 탈퇴·삭제는 백엔드 API가 구현될 때 연결합니다. 팀원별 점수나 가짜 기여도는 표시하지 않습니다. 권한과 잠금 조건은 [API 연결 계약](docs/api-integration.md)에 정리했습니다.

## 검증

```bash
npm test
npm run test:e2e
npm run build
```

단위 테스트는 Node.js 기본 테스트 러너, 브라우저 테스트는 Playwright를 사용합니다. 브라우저 테스트에는 설치된 Google Chrome이 필요합니다. 테스트는 별도 Vite 서버(5174 포트)와 계약 기반 HTTP 응답을 사용하며 운영 데이터는 변경하지 않습니다. 실제 Google 계정 로그인과 운영 서버 연동을 검증하는 테스트는 아닙니다.

개발은 백엔드와 동일한 이슈 → `feature/<기능명>#<이슈번호>` → 기능별 커밋 → 검증 → PR 절차를 따릅니다. 자세한 규칙은 [workflow](docs/workflow.md)를 참고합니다.
