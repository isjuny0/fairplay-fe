# Vercel 운영 자동 배포

원본 `isjuny0/fairplay-fe`의 `main`에 push 또는 PR 병합이 발생하면
`Deploy production to Vercel` workflow가 기존 Vercel 프로젝트에 배포합니다.
GitHub와 Vercel의 저장소 직접 연결은 필요하지 않습니다.

## 필수 Repository Secrets

원본 저장소의 Settings → Secrets and variables → Actions에 등록합니다.

- `VERCEL_TOKEN`: FairPlay 팀의 기존 프로젝트에 배포할 수 있는 Vercel 토큰
- `VERCEL_ORG_ID`: 기존 프로젝트가 속한 Vercel Team ID
- `VERCEL_PROJECT_ID`: 기존 `fairplay-fe` Vercel Project ID

토큰은 코드나 이 문서에 저장하지 않습니다. 만료되면 같은 Secret의 값을 갱신합니다.

## 배포 확인

1. GitHub Actions에서 `Deploy production to Vercel` 실행 결과를 확인합니다.
2. Vercel 프로젝트 Deployments에서 Production 배포가 Ready인지 확인합니다.
3. https://fairplay-fe.vercel.app 에서 변경 내용을 확인합니다.

수동 재배포는 Actions → Deploy production to Vercel → Run workflow에서
`main`을 선택해 실행합니다. 다른 브랜치와 포크 저장소에서는 배포 job을 건너뜁니다.

테스트나 빌드가 실패하면 새 운영 배포는 실행되지 않습니다.
환경 변수는 `vercel pull --environment=production`으로 기존 Vercel 설정을 받습니다.
프론트엔드 화면에 API 데이터가 나타나는지는 API 연결 설정과 백엔드 상태도 확인해야 합니다.
