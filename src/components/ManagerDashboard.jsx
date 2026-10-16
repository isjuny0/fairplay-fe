import ManagerPeerResponses from './ManagerPeerResponses.jsx';
import { useSearchParams } from 'react-router';
import { getManagerDashboard } from '../api/dashboard.js';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { formatDate } from '../lib/domain.js';
import { spacePath } from '../lib/routes.js';
import { completedWorkShare, formatPercent } from '../lib/evaluation.js';
import { MetricCard } from './PlanningUi.jsx';
import Icon from './Icon.jsx';
import { EmptyState, Field, ResourceState } from './ui.jsx';

export default function ManagerDashboard({ context }) {
  const [params, setParams] = useSearchParams();
  const teamId = params.get('teamId') || '';
  const navigate = useAppNavigate();
  const resource = useResource(
    () => getManagerDashboard(context.space.id, teamId),
    [context.space.id, teamId],
  );
  const dashboard = resource.data;
  const selectedTeam = dashboard?.teams.find(
    (team) => String(team.teamId) === teamId,
  );
  const selectedTeamName = context.teamContexts.find(
    ({ team }) => String(team.id) === teamId,
  )?.team.name;
  const selectTeam = (nextTeamId) => {
    const next = new URLSearchParams(params);
    if (nextTeamId) next.set('teamId', String(nextTeamId));
    else next.delete('teamId');
    setParams(next);
  };
  return (
    <section className="stack manager-dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">스페이스 관리자</span>
          <h1>관리자 대시보드</h1>
          <p>팀들의 진행을 살펴보고 필요한 조율과 지원을 준비하세요.</p>
        </div>
        <button
          className="secondary-button"
          disabled={resource.loading}
          onClick={resource.reload}
        >
          현황 새로고침
        </button>
      </div>
      <div className="dashboard-toolbar">
        <Field label="조회할 팀">
          <select
            value={teamId}
            onChange={(event) => selectTeam(event.target.value)}
          >
            <option value="">전체 팀</option>
            {context.teamContexts.map(({ team }) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </Field>
        {teamId && (
          <button className="ghost-button" onClick={() => selectTeam('')}>
            전체 팀 보기
          </button>
        )}
        {dashboard && (
          <div className="dashboard-query-context">
            <p>
              스페이스 전체 · {dashboard.totalTeamCount}팀 · 팀 미소속{' '}
              {dashboard.unassignedCount}명
            </p>
            <time dateTime={dashboard.asOf}>
              조회 기준 {formatDate(dashboard.asOf)}
            </time>
          </div>
        )}
      </div>
      <ResourceState resource={resource}>
        {dashboard && (
          <>
            <section
              className="dashboard-summary"
              aria-label="조회 범위의 작업 현황"
            >
              <div className="section-heading">
                <h2>
                  {teamId ? selectedTeamName || '선택한 팀' : '전체 팀'} 현황
                </h2>
                <span className="field-help">
                  아래 지표와 제출 현황에 같은 조회 범위를 적용합니다.
                </span>
              </div>
              <div className="metric-grid">
                <MetricCard
                  label="마감 지연"
                  value={`${dashboard.overdueTaskCount}건`}
                  description="승인 대기를 포함한 미완료 작업"
                />
                <MetricCard
                  label="승인 대기"
                  value={`${dashboard.pendingApprovalCount}건`}
                  description="지정 승인자의 검토 대기"
                />
                <MetricCard
                  label="장기 정체"
                  value={`${dashboard.staleTaskCount}건`}
                  description="진행 중 마지막 활동 후 48시간 경과"
                />
                <MetricCard
                  label="가입 대기"
                  value={`${dashboard.pendingApplications}명`}
                  description="기간 종료 후 남은 신청 포함"
                />
              </div>
            </section>
            <div className="dashboard-attention-grid">
              {teamId ? (
                selectedTeam && (
                  <section
                    className="dashboard-selected-team"
                    aria-label="선택한 팀 정보"
                  >
                    <h2>팀 정보</h2>
                    <p className="field-help">
                      {selectedTeam.leaderName} · 리더 · 팀원{' '}
                      {selectedTeam.approvedMemberCount}명
                    </p>
                    {selectedTeam.hasMinimumMembers === false && (
                      <p className="field-help">팀원 2명 이상이 필요합니다.</p>
                    )}
                    <dl className="dashboard-team-facts">
                      <div>
                        <dt>진행률 · 예상 작업량</dt>
                        <dd>
                          {formatPercent(
                            selectedTeam.completionRate,
                            '작업 없음',
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>할 일 / 진행 중</dt>
                        <dd>
                          {selectedTeam.todoTaskCount} /{' '}
                          {selectedTeam.inProgressTaskCount}건
                        </dd>
                      </div>
                      <div>
                        <dt>산출물</dt>
                        <dd>{selectedTeam.deliverableCount}개</dd>
                      </div>
                    </dl>
                    <p className="field-help">
                      진행률은 예상 작업량을 반영하며 실제 수행 시간이나 최종
                      기여도 점수가 아닙니다.
                    </p>
                    <div className="dashboard-team-report">
                      <span>
                        리포트 ·{' '}
                        {selectedTeam.reportStatus === 'PUBLISHED'
                          ? '공개'
                          : selectedTeam.reportStatus === 'UNPUBLISHED'
                            ? '비공개'
                            : '미생성'}
                      </span>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          navigate(
                            `${spacePath(context.space.id)}/reports?teamId=${selectedTeam.teamId}`,
                          )
                        }
                      >
                        {selectedTeam.reportId == null
                          ? '리포트 생성 화면'
                          : '리포트 검토 화면'}
                      </button>
                    </div>
                  </section>
                )
              ) : (
                <section className="dashboard-attention">
                  <h2>먼저 확인할 팀</h2>
                  <p className="field-help">
                    마감 지연·작업 정체·승인 대기를 확인하고 필요한 지원을
                    준비하세요.
                  </p>
                  <div className="dashboard-attention-list">
                    {dashboard.teams
                      .filter(
                        (team) =>
                          team.overdueTaskCount ||
                          team.staleTaskCount ||
                          team.pendingApprovalCount,
                      )
                      .map((team) => (
                        <button
                          className="dashboard-team-link"
                          key={team.teamId}
                          aria-pressed={teamId === String(team.teamId)}
                          onClick={() => selectTeam(team.teamId)}
                        >
                          <strong>{team.teamName}</strong>
                          <span>
                            지연 {team.overdueTaskCount} · 정체{' '}
                            {team.staleTaskCount} · 승인 대기{' '}
                            {team.pendingApprovalCount}
                          </span>
                          <Icon name="arrow" />
                        </button>
                      ))}
                    {!dashboard.teams.some(
                      (team) =>
                        team.overdueTaskCount ||
                        team.staleTaskCount ||
                        team.pendingApprovalCount,
                    ) && <p>현재 지연·정체·승인 대기 작업이 없습니다.</p>}
                  </div>
                </section>
              )}
              <section className="dashboard-submissions">
                <div className="section-heading">
                  <h2>평가 제출 현황</h2>
                  <button
                    className="ghost-button"
                    onClick={() =>
                      navigate(`${spacePath(context.space.id)}/rounds`)
                    }
                  >
                    회차 관리
                  </button>
                </div>
                <p className="field-help">
                  {teamId ? '선택한 팀' : '전체 팀'}의 최종 제출 인원입니다.
                </p>
                {dashboard.missingPeerSubmissions.length ? (
                  dashboard.missingPeerSubmissions.map((round) => (
                    <div className="count-row" key={round.roundId}>
                      <span>
                        {round.type === 'MID' ? '중간' : '최종'} 평가 ·{' '}
                        {round.status === 'CLOSED'
                          ? '마감'
                          : round.status === 'DRAFT'
                            ? '대기'
                            : '작성 중'}
                      </span>
                      <strong>
                        {round.status === 'DRAFT'
                          ? '참여자 고정 전'
                          : `${round.submittedCount} / ${round.requiredCount}명 제출`}
                      </strong>
                    </div>
                  ))
                ) : (
                  <p>평가 회차가 없습니다.</p>
                )}
              </section>
            </div>
            {!teamId && (
              <section className="panel dashboard-team-overview">
                <div className="section-heading">
                  <div>
                    <h2>팀별 진행 현황</h2>
                    <p>
                      예상 작업량을 반영한 팀 진행률입니다. 실제 수행 시간이나
                      최종 기여도 점수가 아닙니다.
                    </p>
                  </div>
                </div>
                {dashboard.teams.length ? (
                  <div className="table-scroll desktop-data-table">
                    <table className="data-table dashboard-teams-table">
                      <caption className="sr-only">팀별 진행 현황</caption>
                      <thead>
                        <tr>
                          <th>팀</th>
                          <th>인원</th>
                          <th>할 일</th>
                          <th>진행</th>
                          <th>승인 대기</th>
                          <th>팀 전체 진행률</th>
                          <th>지연 / 정체</th>
                          <th>산출물</th>
                          <th>리포트</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.teams.map((team) => (
                          <tr key={team.teamId}>
                            <th scope="row">
                              <button
                                className="table-name-button"
                                aria-label={`${team.teamName} 현황 보기`}
                                onClick={() => selectTeam(team.teamId)}
                              >
                                {team.teamName}
                              </button>
                              <small>{team.leaderName} · 리더</small>
                              {team.hasMinimumMembers === false && (
                                <small>팀원 2명 이상 필요</small>
                              )}
                            </th>
                            <td>{team.approvedMemberCount}명</td>
                            <td>{team.todoTaskCount}</td>
                            <td>{team.inProgressTaskCount}</td>
                            <td>{team.pendingApprovalCount}</td>
                            <td>
                              {formatPercent(team.completionRate, '작업 없음')}
                            </td>
                            <td>
                              {team.overdueTaskCount} / {team.staleTaskCount}
                            </td>
                            <td>{team.deliverableCount}</td>
                            <td>
                              <span className="dashboard-report-state">
                                {team.reportStatus === 'PUBLISHED'
                                  ? '공개'
                                  : team.reportStatus === 'UNPUBLISHED'
                                    ? '비공개'
                                    : '미생성'}
                              </span>
                              <button
                                className="secondary-button"
                                onClick={() =>
                                  navigate(
                                    `${spacePath(context.space.id)}/reports?teamId=${team.teamId}`,
                                  )
                                }
                              >
                                {team.reportId == null
                                  ? '리포트 생성 화면'
                                  : '리포트 검토 화면'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState>생성된 팀이 없습니다.</EmptyState>
                )}
                <div className="mobile-data-cards">
                  {dashboard.teams.map((team) => (
                    <article key={team.teamId}>
                      <h3>{team.teamName}</h3>
                      <p className="field-help">
                        {team.leaderName} · 리더 · 팀원{' '}
                        {team.approvedMemberCount}명
                      </p>
                      <dl className="card-facts">
                        <div>
                          <dt>진행률 · 예상 작업량</dt>
                          <dd>
                            {formatPercent(team.completionRate, '작업 없음')}
                          </dd>
                        </div>
                        <div>
                          <dt>승인 대기</dt>
                          <dd>{team.pendingApprovalCount}건</dd>
                        </div>
                        <div>
                          <dt>마감 지연 / 장기 정체</dt>
                          <dd>
                            {team.overdueTaskCount} / {team.staleTaskCount}건
                          </dd>
                        </div>
                        <div>
                          <dt>할 일 / 진행 중</dt>
                          <dd>
                            {team.todoTaskCount} / {team.inProgressTaskCount}건
                          </dd>
                        </div>
                      </dl>
                      <p>
                        리포트 ·{' '}
                        {team.reportStatus === 'PUBLISHED'
                          ? '공개'
                          : team.reportStatus === 'UNPUBLISHED'
                            ? '비공개'
                            : '미생성'}
                      </p>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          navigate(
                            `${spacePath(context.space.id)}/reports?teamId=${team.teamId}`,
                          )
                        }
                      >
                        {team.reportId == null
                          ? '리포트 생성 화면'
                          : '리포트 검토 화면'}
                      </button>
                      <details>
                        <summary>산출물·팀 참여 상태</summary>
                        <p>
                          산출물 {team.deliverableCount}개 · 가입 대기{' '}
                          {team.pendingApplications}명
                        </p>
                        {!team.hasMinimumMembers && (
                          <p>팀원 2명 이상이 필요합니다.</p>
                        )}
                      </details>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {dashboard.teams
              .filter((team) => team.members)
              .map((team) => (
                <section
                  className="panel dashboard-member-overview"
                  key={team.teamId}
                >
                  <h2>{team.teamName} · 팀원 수행 현황</h2>
                  <p className="field-help">
                    현재 승인된 팀원의 작업 기록입니다. 작업이 없는 팀원도
                    포함하며 최종 기여도 점수와 구분합니다.
                  </p>
                  <div className="table-scroll desktop-data-table">
                    <table className="data-table dashboard-members-table">
                      <caption className="sr-only">
                        {team.teamName} 팀원 수행 현황
                      </caption>
                      <thead>
                        <tr>
                          <th>팀원</th>
                          <th>담당</th>
                          <th>진행</th>
                          <th>완료</th>
                          <th>현재 팀원 완료 비중</th>
                          <th>공동 수행 설명 미작성</th>
                          <th>자료 확인</th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.members.map((member) => (
                          <tr key={member.userId}>
                            <th scope="row">{member.name}</th>
                            <td>{member.assignedTaskCount}</td>
                            <td>{member.inProgressTaskCount}</td>
                            <td>{member.doneTaskCount}</td>
                            <td>
                              {formatPercent(
                                completedWorkShare(member, team.members),
                                '완료 작업 없음',
                              )}
                            </td>
                            <td>
                              {member.missingContributionDescriptionCount}
                            </td>
                            <td>
                              <button
                                className="secondary-button"
                                onClick={() =>
                                  navigate(
                                    `${spacePath(context.space.id)}/manager/teams/${team.teamId}/members/${member.userId}`,
                                  )
                                }
                              >
                                {member.name} 수행 상세
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mobile-data-cards">
                    {team.members.map((member) => (
                      <article key={member.userId}>
                        <h3>{member.name}</h3>
                        <dl className="card-facts">
                          <div>
                            <dt>담당 / 진행 / 완료</dt>
                            <dd>
                              {member.assignedTaskCount} /{' '}
                              {member.inProgressTaskCount} /{' '}
                              {member.doneTaskCount}건
                            </dd>
                          </div>
                          <div>
                            <dt>공동 수행 설명 미작성</dt>
                            <dd>
                              {member.missingContributionDescriptionCount}건
                            </dd>
                          </div>
                        </dl>
                        <details className="member-extra-facts">
                          <summary>완료 비중·계산 기준</summary>
                          <dl className="card-facts">
                            <div>
                              <dt>현재 팀원 완료 비중</dt>
                              <dd>
                                {formatPercent(
                                  completedWorkShare(member, team.members),
                                  '완료 작업 없음',
                                )}
                              </dd>
                            </div>
                          </dl>
                          <p className="field-help">
                            예상 작업량과 담당 비율을 반영한 현재 팀원의 완료
                            작업 비중입니다. 최종 기여도 점수가 아닙니다.
                          </p>
                        </details>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            navigate(
                              `${spacePath(context.space.id)}/manager/teams/${team.teamId}/members/${member.userId}`,
                            )
                          }
                        >
                          {member.name} 수행 상세
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            <details className="dashboard-reading-guide">
              <summary>현황 읽는 법</summary>
              <p className="field-help">
                현재 팀원 완료 비중은 현재 팀원들의 완료 작업에서 각자가 맡은
                몫을 예상 작업량과 담당 비율로 계산한 값입니다. 실제 시간이나
                최종 기여도 점수가 아닙니다.
              </p>
              <p className="field-help">
                장기 정체는 마지막 활동 후 48시간 이상 지난 진행 작업입니다.
                기록과 수치는 검토를 돕는 정보이며 무임승차 판정이 아닙니다.
                관리자는 작업을 대신 수정·승인하지 않습니다.
              </p>
            </details>
          </>
        )}
      </ResourceState>
      <ManagerPeerResponses context={context} teamId={teamId || undefined} />
    </section>
  );
}
