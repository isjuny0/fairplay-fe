import { useState } from 'react';
import {
  assignTeamDeputy,
  getTeamApplications,
  getTeamMembers,
  reviewTeamApplication,
} from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import { formatDate, isApprovedMember, memberRole } from '../lib/domain.js';
import { EmptyState, ErrorNotice, ResourceState } from './ui.jsx';

export default function TeamMembers({ team, user, onChanged }) {
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
      resource.reload();
      onChanged();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="stack">
      <h1>팀원 관리</h1>
      <ErrorNotice error={error} onRetry={resource.reload} />
      <ResourceState resource={resource}>
        {resource.data && (
          <>
            <section className="panel">
              <h2>승인된 팀원 · {resource.data.members.length}명</h2>
              <ul className="clean-list">
                {resource.data.members.map((member) => (
                  <li className="row-item" key={member.userId}>
                    <span>
                      <strong>{member.name}</strong>{' '}
                      <span className="role-badge">{memberRole(member)}</span>
                      {member.userId === user.id && ' · 나'}
                    </span>
                    {isLeader && !member.isLeader && (
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            assignTeamDeputy(
                              team.id,
                              member.isDeputy ? null : member.userId,
                            ),
                          )
                        }
                      >
                        {member.isDeputy ? '부리더 해제' : '부리더 지정'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            {isLeader && (
              <section className="panel">
                <h2>가입 신청</h2>
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
          </>
        )}
      </ResourceState>
    </section>
  );
}
