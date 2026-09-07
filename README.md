# fairplay-fe

Fairplay 서비스의 웹 프론트엔드입니다.

## 주요 기능

- Google 계정을 이용한 로그인
- 백엔드 OAuth2 인증 엔드포인트 연동

## 기술 스택

- React
- Vite
- JavaScript

## 실행 방법

```bash
npm install
cp .env.example .env
npm run dev
```

프로덕션 빌드는 아래 명령으로 확인합니다.

```bash
npm run build
```

## 환경 변수

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8080` | OAuth2 인증을 제공하는 백엔드 주소 |
| `VITE_AUTH_MODE` | `mock` | `mock`은 화면 확인용, `oauth`는 실제 OAuth2 연동용 |

Google 로그인 버튼을 누르면
기본 `mock` 모드에서는 메인 화면(`/main`)으로 이동합니다. 실제 연동 시
`VITE_AUTH_MODE=oauth`로 설정하면
`{VITE_API_BASE_URL}/oauth2/authorization/google`로 이동합니다.

## 브랜치 전략

- `main`: 항상 배포 가능한 상태
- `develop`: 개발 통합 브랜치
- `feature/*`: 기능 단위 개발 브랜치
- `hotfix/*`: 배포 이후 긴급 수정 브랜치
- `release/*`: 배포 전 QA 브랜치

## 커밋 메시지

Conventional Commits의 `<타입>(옵션): 내용` 형식을 사용합니다.

```text
feat(auth): 구글 OAuth2 로그인 구현
fix(board): 게시글 수정 시 null 에러 해결
docs: PRD 초안 작성
```
