import { formatDate } from '../lib/domain.js';
import { spacePath, teamMenuPath } from '../lib/routes.js';

export default function SpaceGuide({
  space,
  teams,
  joinedTeam,
  buildingOpen,
  navigate,
  onCreateTeam,
  onReload,
}) {
  const isManager = space.myRole === 'MANAGER';
  const pendingTeam = teams.find(
    (team) => team.myMembershipStatus === 'PENDING',
  );
  const compact = isManager
    ? Boolean(space.teamBuildingOpensAt && space.teamBuildingClosesAt)
    : Boolean(joinedTeam && joinedTeam.approvedMemberCount >= 2);
  let title, description, action, onAction;
  if (isManager) {
    const periodConfigured = Boolean(
      space.teamBuildingOpensAt && space.teamBuildingClosesAt,
    );
    if (!periodConfigured) {
      title = '팀 빌딩 기간을 먼저 지정하세요';
      description =
        '팀을 만들고 가입할 수 있는 기간을 설정한 뒤 참여 코드를 공유하세요.';
      action = '팀 빌딩 기간 설정';
      onAction = () => navigate(`${spacePath(space.id)}/settings`);
    } else if (
      buildingOpen ||
      new Date(space.teamBuildingOpensAt) > new Date()
    ) {
      title = buildingOpen
        ? '참여 코드를 공유하고 팀 구성을 확인하세요'
        : '참여 코드를 공유해 팀 빌딩을 준비하세요';
      description = `팀 빌딩은 ${formatDate(space.teamBuildingOpensAt)}부터 ${formatDate(space.teamBuildingClosesAt)}까지입니다. 유효한 참여 코드는 스페이스 관리에서 확인할 수 있습니다.`;
      action = '참여 코드 관리';
      onAction = () => navigate(`${spacePath(space.id)}/settings`);
    } else {
      title = '팀들의 진행 현황을 확인하세요';
      description =
        '대시보드에서 작업 지연과 승인 대기를 확인하고 필요한 지원을 준비하세요.';
      action = '팀 현황 확인';
      onAction = () => navigate(`${spacePath(space.id)}/dashboard`);
    }
  } else if (joinedTeam) {
    const ready = joinedTeam.approvedMemberCount >= 2;
    title = ready
      ? '담당 작업을 정하고 프로젝트를 시작하세요'
      : '팀원이 한 명 더 필요합니다';
    description = ready
      ? '작업에 담당자와 완료 승인자를 지정하고, 수행한 내용을 산출물로 남기세요.'
      : '승인된 팀원이 2명 이상이어야 작업을 진행할 수 있습니다. 팀원 관리에서 가입 신청을 확인하세요.';
    action = ready ? '담당 작업 확인' : '팀원 확인';
    onAction = () =>
      navigate(
        teamMenuPath(
          space.id,
          joinedTeam.id,
          ready ? '작업 보드' : '팀원 관리',
        ),
      );
  } else if (pendingTeam) {
    title = `${pendingTeam.name}의 가입 승인을 기다리고 있습니다`;
    description =
      '리더·부리더가 가입을 승인하면 팀 작업을 시작할 수 있습니다. 가입 신청만으로는 팀원이 되지 않습니다.';
    action = '가입 상태 새로 확인';
    onAction = onReload;
  } else if (buildingOpen) {
    title = teams.length
      ? '함께할 팀에 가입을 신청하세요'
      : '첫 팀을 만들어 팀원을 모집하세요';
    description =
      '팀에 가입하거나 직접 만든 뒤, 승인된 팀원 2명 이상이 모이면 작업을 시작할 수 있습니다.';
    action = teams.length ? '가입할 팀 살펴보기' : '새 팀 시작하기';
    onAction = teams.length
      ? () => {
          const list = document.getElementById('space-team-list');
          list?.focus();
          list?.scrollIntoView({ block: 'center' });
        }
      : onCreateTeam;
  } else {
    title = '팀 빌딩 기간을 확인하세요';
    description =
      space.teamBuildingOpensAt &&
      new Date(space.teamBuildingOpensAt) > new Date()
        ? `${formatDate(space.teamBuildingOpensAt)}부터 팀 생성과 가입 신청이 가능합니다.`
        : '현재 팀 생성과 가입 신청이 제한됩니다. 팀 빌딩 일정은 스페이스 관리자에게 확인하세요.';
  }
  const explanation = (
    <>
      <p>{description}</p>
      <ol className="getting-started-steps" aria-label="프로젝트 시작 순서">
        {(isManager
          ? ['팀 빌딩 기간 설정', '참여 코드 공유', '팀 진행 현황 확인']
          : ['팀 가입·생성', '가입 승인·팀원 모집', '작업 수행']
        ).map((step, index) => (
          <li key={step}>
            <span aria-hidden="true">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </>
  );
  return (
    <section
      className={`panel getting-started ${compact ? 'getting-started-compact' : ''}`}
      aria-label="다음 단계 안내"
    >
      <div>
        <span className="eyebrow">
          {isManager ? '관리자 시작 안내' : '참여자 시작 안내'}
        </span>
        <h2>{title}</h2>
        {compact ? (
          <details className="guide-explanation">
            <summary>시작 안내 펼쳐보기</summary>
            {explanation}
          </details>
        ) : (
          explanation
        )}
      </div>
      {action && (
        <button className="primary-button" onClick={onAction}>
          {action}
        </button>
      )}
    </section>
  );
}
