import RefreshButton from './RefreshButton.jsx';
import { useEffect, useState } from 'react';
import {
  getTeamApplications,
  reviewTeamApplication,
} from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { formatDate, isApprovedMember, memberRole } from '../lib/domain.js';
import { EmptyState, ErrorNotice, ResourceState } from './ui.jsx';

export default function TeamMembers({
  team,
  user,
  membersResource,
  readOnly = false,
  onChanged,
}) {
  const { notify } = useInteractions();
  const isLeader = !readOnly && isApprovedMember(team) && team.leaderId === user.id;
  const resource = useResource(
    () => (isLeader ? getTeamApplications(team.id) : Promise.resolve([])),
    [team.id, isLeader],
  );
  const [pendingAction, setPendingAction] = useState(null);
  const busy = Boolean(pendingAction);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (
      resource.data != null &&
      !resource.loading &&
      !resource.error &&
      membersResource.data != null &&
      !membersResource.loading &&
      !membersResource.error
    )
      setError(null);
  }, [
    resource.data,
    resource.loading,
    resource.error,
    membersResource.data,
    membersResource.loading,
    membersResource.error,
  ]);
  const members = membersResource.data || [];
  const applications = resource.data || [];
  const reload = () => {
    resource.reload();
    onChanged();
  };
  const run = async ({ action, pendingMessage, successMessage }) => {
    setPendingAction(pendingMessage);
    setError(null);
    try {
      await action();
      notify(successMessage);
      reload();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setPendingAction(null);
    }
  };
  const reviewApplication = (application, status) =>
    run({
      action: () => reviewTeamApplication(application.id, status),
      pendingMessage: `${application.name}님의 가입 신청을 ${status === 'APPROVED' ? '승인' : '반려'}하는 중…`,
      successMessage: `${application.name}님의 가입 신청을 ${status === 'APPROVED' ? '승인' : '반려'}했습니다.`,
    });
  return (
    <section className="stack team-member-directory">
      <div className="page-heading page-heading--compact">
        <div className="member-directory-title">
          <h1>{readOnly ? '팀원 보기' : '팀원 관리'}</h1>
          {membersResource.data != null && !membersResource.error && <span className="member-directory-count" aria-label={`현재 팀원 ${members.length}명`}>{members.length}명</span>}
        </div>
        <RefreshButton
          onClick={reload}
          disabled={busy || resource.loading || membersResource.loading}
        />
      </div>
      {pendingAction && (
        <p className="field-help" role="status">
          {pendingAction}
        </p>
      )}
      <ErrorNotice error={error} onRetry={reload} />
      <div className="member-directory-sections">
        <ResourceState resource={membersResource} label="팀원 정보">
          <section className="member-directory-section">
            <div className="member-roster-heading" aria-hidden="true"><span>팀원</span><span>역할</span></div>
            <ul className="clean-list member-roster" aria-label="현재 팀원">
              {members.map((member) => (
                <li className={`row-item member-roster-row${member.userId === user.id ? ' is-self' : ''}`} key={member.userId}>
                  <span className="member-identity">
                    <span className="member-avatar" aria-hidden="true">
                      {member.name.slice(0, 1)}
                    </span>
                    <span>
                      <strong>{member.name}</strong>
                      {member.userId === user.id && (
                        <span className="member-self">나</span>
                      )}
                    </span>
                  </span>
                  <span className={`member-roster-role${member.role === 'LEADER' ? ' is-leader' : ''}`}>{memberRole(member)}</span>
                </li>
              ))}
            </ul>
            {!readOnly && !isLeader && <p className="member-roster-note">가입 신청 검토는 리더가 관리합니다.</p>}
          </section>
        </ResourceState>
        {isLeader && (
          <section className="member-directory-section application-directory">
            <div className="directory-section-heading">
              <div className="member-directory-title">
                <h2>가입 신청</h2>
                {resource.data != null && !resource.error && <span className="member-directory-count">{applications.length}건</span>}
              </div>
            </div>
            <ResourceState resource={resource} label="가입 신청">
              {applications.length ? (
                <ul className="clean-list">
                  {applications.map((application) => (
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
                          disabled={
                            busy ||
                            resource.loading ||
                            membersResource.loading ||
                            Boolean(membersResource.error)
                          }
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
                            membersResource.loading ||
                            Boolean(membersResource.error) ||
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
            </ResourceState>
          </section>
        )}
      </div>
    </section>
  );
}
