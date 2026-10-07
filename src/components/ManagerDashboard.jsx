import { useSearchParams } from 'react-router';
import { requestPlanned } from '../api/planned.js';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { spacePath } from '../lib/routes.js';
import { completedWorkShare, formatPercent } from '../lib/evaluation.js';
import { MetricCard, MockNotice } from './PlanningUi.jsx';
import { EmptyState, Field, ResourceState } from './ui.jsx';

export default function ManagerDashboard({ context }) {
  const [params, setParams] = useSearchParams();
  const teamId = params.get('teamId') || '';
  const navigate = useAppNavigate();
  const resource = useResource(
    () =>
      requestPlanned(
        context,
        `/api/spaces/${context.space.id}/manager-dashboard${teamId ? `?teamId=${teamId}` : ''}`,
      ),
    [context.space.id, teamId],
  );
  const dashboard = resource.data;
  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">스페이스 관리자</span>
          <h1>관리자 대시보드</h1>
          <p>팀들의 진행을 살펴보고 필요한 조율과 지원을 준비하세요.</p>
        </div>
        <button className="secondary-button" onClick={resource.reload}>
          현황 새로고침
        </button>
      </div>
      <MockNotice />
      <ResourceState resource={resource}>
        {dashboard && (
          <>
            <section className="panel next-action-panel">
              <h2>먼저 확인할 팀</h2>
              <p className="field-help">
                마감 지연·작업 정체·승인 대기를 확인하고 필요한 지원을
                준비하세요.
              </p>
              <div className="stack">
                {dashboard.teams
                  .filter(
                    (team) =>
                      team.overdueTaskCount ||
                      team.staleTaskCount ||
                      team.pendingApprovalCount,
                  )
                  .map((team) => (
                    <button
                      className="secondary-button row-item"
                      key={team.teamId}
                      onClick={() => setParams({ teamId: String(team.teamId) })}
                    >
                      <strong>{team.teamName}</strong>
                      <span>
                        지연 {team.overdueTaskCount} · 정체{' '}
                        {team.staleTaskCount} · 승인 대기{' '}
                        {team.pendingApprovalCount}
                      </span>
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
            <div className="metric-grid">
              <MetricCard
                accent
                label="전체 팀"
                value={`${dashboard.totalTeamCount}팀`}
                description={`팀 미소속 ${dashboard.unassignedCount}명`}
              />
              <MetricCard
                label="마감 지연"
                value={`${dashboard.overdueTaskCount}건`}
                description="마감이 지난 미완료 작업"
              />
              <MetricCard
                label="승인 대기"
                value={`${dashboard.pendingApprovalCount}건`}
                description="지정 승인자의 검토 대기"
              />
              <MetricCard
                label="AI 확인 필요"
                value={`${dashboard.aiNeedsReviewCount}건`}
                description="유효 점수가 없는 평가"
              />
            </div>
            <section className="panel">
              <div className="page-heading">
                <div>
                  <h2>팀별 진행 현황</h2>
                  <p>
                    완료율은 작업 개수 기준입니다. 팀 홈의 예상 작업량을 반영한
                    진행률과 구분됩니다.
                  </p>
                </div>
                <Field label="조회할 팀">
                  <select
                    value={teamId}
                    onChange={(event) =>
                      setParams(
                        event.target.value
                          ? { teamId: event.target.value }
                          : {},
                      )
                    }
                  >
                    <option value="">전체 팀</option>
                    {context.teamContexts.map(({ team }) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {dashboard.teams.length ? (
                <div className="table-scroll desktop-data-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>팀</th>
                        <th>인원</th>
                        <th>할 일</th>
                        <th>진행</th>
                        <th>승인 대기</th>
                        <th>완료율 · 개수</th>
                        <th>지연 / 정체</th>
                        <th>산출물</th>
                        <th>리포트</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.teams.map((team) => (
                        <tr key={team.teamId}>
                          <th>
                            {team.teamName}
                            <small>{team.leaderName} · 리더</small>
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
                            {team.latestReportStatus === 'PUBLISHED'
                              ? '공개'
                              : team.latestReportStatus === 'DRAFT'
                                ? '초안'
                                : '미생성'}
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
                      {team.leaderName} · 리더 · 팀원 {team.approvedMemberCount}
                      명
                    </p>
                    <dl className="card-facts">
                      <div>
                        <dt>완료율 · 작업 개수</dt>
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
                    <details>
                      <summary>산출물·리포트 상태</summary>
                      <p>
                        산출물 {team.deliverableCount}개 · 리포트{' '}
                        {team.latestReportStatus === 'PUBLISHED'
                          ? '공개'
                          : team.latestReportStatus === 'DRAFT'
                            ? '초안'
                            : '미생성'}
                      </p>
                    </details>
                  </article>
                ))}
              </div>
            </section>
            <section className="panel">
              <h2>평가 제출 현황</h2>
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
                      {round.submittedCount} / {round.requiredCount}명 제출
                    </strong>
                  </div>
                ))
              ) : (
                <p>평가 회차가 없습니다.</p>
              )}
            </section>
            {dashboard.teams.map((team) => (
              <section className="panel" key={team.teamId}>
                <h2>{team.teamName} · 팀원 수행 현황</h2>
                <div className="table-scroll desktop-data-table">
                  <table className="data-table">
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
                          <th>{member.name}</th>
                          <td>{member.assignedTaskCount}</td>
                          <td>{member.inProgressTaskCount}</td>
                          <td>{member.doneTaskCount}</td>
                          <td>
                            {formatPercent(
                              completedWorkShare(member, team.members),
                              '완료 작업 없음',
                            )}
                          </td>
                          <td>{member.missingContributionDescriptionCount}</td>
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
                          예상 작업량과 담당 비율을 반영한 현재 팀원의 완료 작업
                          비중입니다. 최종 기여도 점수가 아닙니다.
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
            <p className="field-help">
              현재 팀원 완료 비중은 현재 팀원들의 완료 작업에서 각자가 맡은 몫을
              예상 작업량과 담당 비율로 계산한 값입니다. 실제 시간이나 최종
              기여도 점수가 아닙니다.
            </p>
            <p className="field-help">
              장기 정체는 마지막 활동 후 48시간 이상 지난 진행 작업입니다.
              기록과 수치는 검토를 돕는 정보이며 무임승차 판정이 아닙니다.
              관리자는 작업을 대신 수정·승인하지 않습니다.
            </p>
          </>
        )}
      </ResourceState>
    </section>
  );
}
