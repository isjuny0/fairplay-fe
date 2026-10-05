# API 연결 계약

기준: [화면 구성·기능 정리](https://app.notion.com/p/3ef21f76795a812d9d5dea3554bf2d7e), [API 명세서](https://app.notion.com/p/3e221f76795a81c28eaac92a0350cee6), fairplay-be main의 컨트롤러·DTO·서비스. 모든 경로 앞에는 `/api`가 붙습니다.

## 화면과 실제 API

| 화면 | 연결 API |
| --- | --- |
| 로그인·공통 | `GET /me`, `GET /auth/csrf`, `POST /auth/google`, `POST /auth/logout` |
| 내 스페이스 | `GET /spaces`, `POST /spaces`, `POST /spaces/join` |
| 스페이스·팀 목록 | `GET /spaces/{id}`, `GET /spaces/{id}/teams`, `GET /teams/{id}` |
| 스페이스 관리 | `PATCH /spaces/{id}/team-building-period`, `GET /spaces/{id}/join-code`, `POST /spaces/{id}/join-code`, `POST /spaces/{id}/join-code/rotate`, `POST /spaces/{id}/join-code/revoke` |
| 팀 생성·가입 | `POST /spaces/{id}/teams`, `POST /teams/{id}/applications` |
| 팀원 관리 | `GET /teams/{id}/members`, `GET /teams/{id}/applications`, `PATCH /team-applications/{id}`, `PATCH /teams/{id}/deputy` |
| 작업 보드·상세 | `GET /teams/{id}/tasks`, `POST /teams/{id}/tasks`, `GET /tasks/{id}`, `PATCH /tasks/{id}`, `DELETE /tasks/{id}` |
| 승인자·수행 설명 | `PATCH /tasks/{id}/completion-reviewer`, `PATCH /tasks/{id}/contribution` |
| 산출물 | `GET /teams/{id}/deliverables`, `POST /teams/{id}/deliverables`, `POST /teams/{id}/deliverables/files`, `PATCH /deliverables/{id}`, `DELETE /deliverables/{id}`, `GET /deliverables/{id}/file` |
| 완료 요청·검토 | `POST /tasks/{id}/completion-requests`, `GET /teams/{id}/approvals`, `GET /tasks/{id}/approvals`, `POST /approvals/{id}/approve`, `POST /approvals/{id}/reject` |

## 권한과 상태

- 스페이스 생성자는 해당 스페이스의 MANAGER이다. 팀 빌딩 기간은 생성 후 관리 화면에서 별도로 지정한다. 팀 생성·가입 신청은 열린 기간과 서버의 허용 플래그를 따른다. 가입 대기는 팀 소속 권한을 부여하지 않는다.
- 리더만 가입 신청을 처리하고 부리더를 지정·해제한다. 관리자라는 이유만으로 팀 작업에 참여하지 않는다. 관리자가 팀에 소속되지 않으면 팀원·산출물 조회만 제공하며 작업 API를 호출하지 않는다.
- 승인된 팀원 2명 이상이어야 작업 생성이 가능하다. 제목·설명·가중치·마감·담당 배분(합계 100%)·승인자가 필수이다. 별도의 완료 조건 필드를 만들지 않고 작업 설명에 작성한다.
- 승인자 후보는 비담당 리더 → 비담당 부리더 → 비담당 팀원 순서이다. 전원 담당이면 리더·부리더만 후보로 제공한다. 승인자인 담당자 본인은 완료 요청할 수 없으며 다른 담당자가 요청해야 한다.
- TODO·IN_PROGRESS의 작업 상세는 담당자와 리더·부리더가 수정한다. 상태 변경은 담당자만 가능하며 완료 상태를 직접 PATCH하지 않는다. 완료 요청은 서버의 `canRequestCompletion`과 차단 사유를 따른다.
- 수행 설명은 본인만 수정한다. 공동 담당은 모두 10~1000자 설명이 필요하고 단독 담당은 선택이다. 비워서 저장할 때 `contributionDescription: null`을 명시한다.
- 승인 대기·완료 작업은 작업과 연결 산출물을 잠근다. 이력이 없는 작업만 리더·부리더에게 삭제를 제공한다. 승인 검토는 지정 승인자에게만 노출하며 반려 사유는 10~500자이다. 반려 후 다시 수행·수정할 수 있다.
- 팀 공용 산출물은 작성자가 관리하고 리더·부리더는 제목·분류만 정리한다. 작업 연결 산출물은 수정 가능한 상태의 해당 작업 담당자만 관리한다. 자료는 최신 내용만 유지하며 과거 파일 사본 다운로드를 제공하지 않는다.

## 요청과 오류

- 모든 요청에 `credentials: include`를 사용한다. 변경 요청에는 `/auth/csrf`의 `headerName`과 `token`을 넣는다. 로그인 후 토큰을 새로 발급하고 `INVALID_CSRF_TOKEN` 403만 한 번 갱신·재시도한다.
- 401은 세션 만료로 처리하고 로그인 화면으로 돌아간다. 일반 403과 버전 충돌 409는 변경 요청을 자동 재전송하지 않는다. 충돌 시 입력을 유지하고 최신 정보를 다시 불러온 뒤 검토하도록 안내한다.
- 수정·완료 요청은 `expectedVersion`, 삭제는 같은 이름의 쿼리 파라미터를 사용한다. 산출물 변경 후 작업 버전도 다시 조회한다.
- 날짜 입력·표시는 한국 시간이며 요청은 `+09:00`이 포함된 값으로 전송한다.
- TEXT·URL 생성은 JSON, FILE 생성은 multipart `taskId`(선택)·`title`·`description`(선택)·`category`·`file`이다. 파일 교체는 `metadata` JSON 파트와 `file` 두 파트이다. 브라우저가 multipart boundary를 생성하도록 Content-Type을 직접 지정하지 않는다.
- 파일은 PDF·PNG·JPEG·TXT·MD, 파일당 10MiB, 팀 전체 1GiB이다. 다운로드는 인증된 fetch 후 Blob으로 저장한다. 업로드 사전 검증 이후 실제 형식·용량·권한 판정은 서버가 수행한다.
- 참여 코드는 재조회·만료·철회·재발급만 제공한다. 만료된 코드가 조회되지 않아 최초 발급이 충돌하는 경우 재발급 버튼으로 rotate한다. 횟수 제한이나 철회 이력은 제공하지 않는다.

## 제외 범위와 검증 한계

AI 평가 결과·재시도, 동료 평가, 기여도 리포트, 본인 현황 집계, 관리자 팀 집계, 탈퇴·팀 삭제는 현재 구현 API가 없어 화면에서 제공하지 않는다. 사람의 완료 승인을 AI 평가 완료로 표시하지 않는다.

Node 단위 테스트는 API 형식·권한·시간 변환을 확인한다. Playwright는 계약 기반 응답을 이용해 생성·완료 요청·반려·잠금·권한·파일·충돌·세션 만료·반응형 화면을 확인한다. 운영 배포, 실제 Google 계정 로그인, 운영 데이터 연동은 별도 확인이 필요하다.
