import Icon from './Icon.jsx';
import { useState } from 'react';
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
  const { notify } = useInteractions();
  const isLeader = isApprovedMember(team) && team.leaderId === user.id;
  const resource = useResource(
    async () => ({
      members: await getTeamMembers(team.id),
      applications: isLeader ? await getTeamApplications(team.id) : [],
    }),
    [team.id, isLeader],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      notify('팀원 상태를 변경했습니다.');
      resource.reload();
      onChanged();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
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
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            assignTeamDeputy(
                              team.id,
                              member.role === 'DEPUTY' ? null : member.userId,
                            ),
                          )
                        }
                      >
                        {member.role === 'DEPUTY'
                          ? '부리더 해제'
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
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                reviewTeamApplication(
                                  application.id,
                                  'REJECTED',
                                ),
                              )
                            }
                          >
                            반려
                          </button>
                          <button
                            className="primary-button"
                            disabled={busy || !application.canApprove}
                            onClick={() =>
                              run(() =>
                                reviewTeamApplication(
                                  application.id,
                                  'APPROVED',
                                ),
                              )
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
