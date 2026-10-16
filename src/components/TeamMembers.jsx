import Icon from './Icon.jsx';
import { useEffect, useState } from 'react';
import {
  assignTeamDeputy,
  getTeamApplications,
  getTeamMembers,
  reviewTeamApplication,
} from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { formatDate, isApprovedMember, memberRole } from '../lib/domain.js';
import { EmptyState, ErrorNotice, ResourceState } from './ui.jsx';

export default function TeamMembers({ team, user, onChanged }) {
  const { notify, confirm } = useInteractions();
  const isLeader = isApprovedMember(team) && team.leaderId === user.id;
  const resource = useResource(
    async () => ({
      members: await getTeamMembers(team.id),
      applications: isLeader ? await getTeamApplications(team.id) : [],
    }),
    [team.id, isLeader],
  );
  const [pendingAction, setPendingAction] = useState(null);
  const busy = Boolean(pendingAction);
  const [error, setError] = useState(null);
  useEffect(() => {
    setError(null);
  }, [resource.data]);
  const currentDeputy = resource.data?.members.find(
    (member) => member.role === 'DEPUTY',
  );
  const run = async ({ action, pendingMessage, successMessage }) => {
    setPendingAction(pendingMessage);
    setError(null);
    try {
      await action();
      notify(successMessage);
      resource.reload();
      onChanged();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setPendingAction(null);
    }
  };
  const changeDeputy = async (member) => {
    const removing = member.role === 'DEPUTY';
    if (!removing && currentDeputy) {
      const accepted = await confirm({
        title: '부리더 변경',
        message: `${currentDeputy.name}님의 부리더 역할을 해제하고 ${member.name}님을 새 부리더로 지정합니다. 변경할까요?`,
        label: '부리더 변경',
      });
      if (!accepted) return;
    }
    await run({
      action: () => assignTeamDeputy(team.id, removing ? null : member.userId),
      pendingMessage: removing
        ? `${member.name}님의 부리더 역할을 해제하는 중…`
        : `${member.name}님을 부리더로 지정하는 중…`,
      successMessage: removing
        ? `${member.name}님의 부리더 역할을 해제했습니다.`
        : `${member.name}님을 부리더로 지정했습니다.`,
    });
  };
  const reviewApplication = (application, status) =>
    run({
      action: () => reviewTeamApplication(application.id, status),
      pendingMessage: `${application.name}님의 가입 신청을 ${status === 'APPROVED' ? '승인' : '반려'}하는 중…`,
      successMessage: `${application.name}님의 가입 신청을 ${status === 'APPROVED' ? '승인' : '반려'}했습니다.`,
    });
  return (
    <section className="stack team-member-directory">
      <div className="page-heading">
        <div>
          <h1>팀원 관리</h1>
          <p>
            {isLeader
              ? '팀원 역할을 관리하고 가입 신청을 검토하세요.'
              : '팀의 구성원과 역할을 확인하세요.'}
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={resource.reload}
          disabled={busy || resource.loading}
        >
          <Icon name="refresh" />
          새로고침
        </button>
      </div>
      {pendingAction && (
        <p className="field-help" role="status">
          {pendingAction}
        </p>
      )}
      <ErrorNotice error={error} onRetry={resource.reload} />
      <ResourceState resource={resource}>
        {resource.data && (
          <div className="member-directory-sections">
            <section className="member-directory-section">
              <div className="directory-section-heading">
                <div>
                  <h2>승인된 팀원 · {resource.data.members.length}명</h2>
                  <p>
                    {isLeader
                      ? '부리더는 한 명만 지정할 수 있습니다.'
                      : '역할 변경과 가입 신청 검토는 리더가 관리합니다.'}
                  </p>
                </div>
              </div>
              <ul className="clean-list">
                {resource.data.members.map((member) => (
                  <li className="row-item" key={member.userId}>
                    <span className="member-identity">
                      <span className="member-avatar" aria-hidden="true">
                        {member.name.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{member.name}</strong>{' '}
                        <span className="role-badge">{memberRole(member)}</span>
                        {member.userId === user.id && (
                          <span className="member-self">나</span>
                        )}
                      </span>
                    </span>
                    {isLeader && member.role !== 'LEADER' && (
                      <button
                        className="secondary-button"
                        disabled={busy || resource.loading}
                        onClick={() => changeDeputy(member)}
                      >
                        {member.role === 'DEPUTY'
                          ? '부리더 해제'
                          : currentDeputy
                            ? '부리더 변경'
                            : '부리더 지정'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            {isLeader && (
              <section className="member-directory-section application-directory">
                <div className="directory-section-heading">
                  <div>
                    <h2>가입 신청 · {resource.data.applications.length}건</h2>
                    <p>
                      승인하면 팀원으로 합류합니다. 가입 승인 조건이 충족되지
                      않아도 반려할 수 있습니다.
                    </p>
                  </div>
                </div>
                {resource.data.applications.length ? (
                  <ul className="clean-list">
                    {resource.data.applications.map((application) => (
                      <li className="row-item" key={application.id}>
                        <span>
                          <strong>{application.name}</strong>
                          <small>{formatDate(application.requestedAt)}</small>
                          {!application.canApprove && (
                            <small>
                              현재 가입 승인 조건을 충족하지 않습니다.
                            </small>
                          )}
                        </span>
                        <div className="heading-actions">
                          <button
                            className="secondary-button"
                            disabled={busy || resource.loading}
                            onClick={() =>
                              reviewApplication(application, 'REJECTED')
                            }
                          >
                            반려
                          </button>
                          <button
                            className="primary-button"
                            disabled={
                              busy ||
                              resource.loading ||
                              !application.canApprove
                            }
                            onClick={() =>
                              reviewApplication(application, 'APPROVED')
                            }
                          >
                            가입 승인
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>대기 중인 가입 신청이 없습니다.</EmptyState>
                )}
              </section>
            )}
          </div>
        )}
      </ResourceState>
    </section>
  );
}
