import Icon from './Icon.jsx';
import { formatDate } from '../lib/domain.js';
import useResource from '../hooks/useResource.js';
import { getMyWorkSummary } from '../api/teams.js';
import { formatPercent } from '../lib/evaluation.js';
import { ResourceState } from './ui.jsx';
import { MetricCard, ProgressBar } from './PlanningUi.jsx';

export default function TeamHome({ context, onNavigate }) {
  const resource = useResource(
    () => getMyWorkSummary(context.team.id),
    [context.team.id, context.user.id],
  );
  const summary = resource.data;
  return (
    <section className="stack team-home">
      <div className="page-heading">
        <div>
          <h1>{context.team.name}</h1>
          <p>내가 맡은 작업과 팀의 진행 상황을 확인하세요.</p>
        </div>
        <div className="heading-actions">
          <button
            className="secondary-button"
            disabled={resource.loading}
            onClick={resource.reload}
          >
            <Icon name="refresh" />
            현황 새로고침
          </button>
          <button
            className="primary-button"
            onClick={() => onNavigate('작업', { mine: '1' })}
          >
            내 작업 확인
          </button>
        </div>
      </div>
      <ResourceState resource={resource} label="본인 작업 현황">
        {summary && (
          <>
            <div className="team-home-summary">
              <section className="panel next-action-panel" aria-label="지금 확인할 작업">
                <div className="section-heading home-summary-context">
                  <h2>지금 확인할 작업</h2>
                  {summary.asOf && (
                    <time dateTime={summary.asOf}>
                      조회 기준 {formatDate(summary.asOf)}
                    </time>
                  )}
                </div>
                <div className="action-summary">
                  <button
                    className={`home-action-link${summary.myOverdueTaskCount > 0 ? ' has-overdue' : ''}`}
                    onClick={() =>
                      onNavigate('작업', {
                        mine: '1',
                        overdue: 'work',
                        view: 'list',
                      })
                    }
                  >
                    <span className="home-action-content">
                      <span className="home-action-title">
                        <span>내 마감 지연</span>
                        <strong>{summary.myOverdueTaskCount}건</strong>
                      </span>
                      <span className="home-action-description">마감이 지난 할 일·진행 중 작업</span>
                    </span>
                    <Icon name="arrow" />
                  </button>
                  <button
                    className="home-action-link"
                    onClick={() =>
                      onNavigate('작업', {
                        mine: '1',
                        status: 'PENDING_APPROVAL',
                      })
                    }
                  >
                    <span className="home-action-content">
                      <span className="home-action-title">
                        <span>내 승인 대기</span>
                        <strong>{summary.myPendingApprovalCount}건</strong>
                      </span>
                      <span className="home-action-description">내 담당 작업의 승인 결과 확인</span>
                    </span>
                    <Icon name="arrow" />
                  </button>
                </div>
                <p className="field-help">
                  {summary.myOverdueTaskCount === 0 && summary.myPendingApprovalCount === 0
                    ? '현재 마감 지연이나 승인 대기 중인 내 작업이 없습니다.'
                    : '마감 지연은 할 일·진행 중인 내 작업만 집계하며, 승인 대기 중인 작업은 제외합니다.'}
                </p>
              </section>
              <section className="panel own-work-panel" aria-label="본인 작업 현황">
                <div className="section-heading home-metric-heading">
                  <h2>본인 작업 현황</h2>
                  <span className="field-help">현재 등록된 작업 기준</span>
                </div>
                <div className="metric-grid three">
                  <MetricCard
                    label="팀 전체 작업 중 내 담당 비중"
                    value={formatPercent(summary.myAssignedShare)}
                    description="팀 전체 분량 중 내가 맡은 몫"
                  />
                  <MetricCard
                    label="팀 전체 작업 중 내 완료 비중"
                    value={formatPercent(summary.myCompletedContributionRate)}
                    description="팀 전체 분량 중 내가 완료한 몫"
                  />
                  <MetricCard
                    label="내 담당 작업 완료율"
                    value={formatPercent(
                      summary.myTaskCompletionRate,
                      summary.teamTotalWeight
                        ? '담당 작업 없음'
                        : '계산할 작업 없음',
                    )}
                    description="내가 맡은 분량 중 완료한 비중"
                  />
                </div>
                <details className="home-metric-help">
                  <summary>지표 계산 기준</summary>
                  <p>현재 등록된 작업의 예상 작업량과 담당 비율을 기준으로 계산합니다. 내 담당·완료 비중은 팀 전체 작업량을, 내 담당 작업 완료율은 내가 맡은 작업량을 기준으로 합니다. 계산할 분량이 없으면 ‘계산할 작업 없음’ 또는 ‘담당 작업 없음’으로 표시합니다.</p>
                </details>
              </section>
              <section className="panel progress-panel">
                <div className="home-progress-overview">
                  <h2>팀 전체 진행률</h2>
                  <ProgressBar
                    value={summary.teamProgressRate}
                    label="예상 작업량을 반영한 팀 진행률"
                  />
                  <strong className="hero-number">{formatPercent(summary.teamProgressRate)}</strong>
                </div>
                <p className="field-help">현재 등록된 작업의 예상 작업량을 반영한 진행률입니다. 실제 소요 시간이나 최종 기여도 점수가 아닙니다.</p>
              </section>
            </div>
            <section className="panel collaboration-panel">
              <h2>평가·리포트</h2>
              <div className="collaboration-navigation">
                <button
                  className="collaboration-link"
                  aria-label="동료 평가 작성"
                  onClick={() => onNavigate('동료 평가')}
                >
                  <span>
                    <strong>동료 평가 작성</strong>
                    <small>팀원의 수행 행동을 돌아보고 평가를 제출하세요.</small>
                  </span>
                  <Icon name="arrow" />
                </button>
                <button
                  className="collaboration-link"
                  aria-label="공개 리포트 보기"
                  onClick={() => onNavigate('기여도 리포트')}
                >
                  <span>
                    <strong>공개 리포트 보기</strong>
                    <small>관리자가 공개한 결과와 본인의 계산 근거를 확인하세요.</small>
                  </span>
                  <Icon name="arrow" />
                </button>
              </div>
            </section>
            <p className="field-help">
              본인의 작업 현황만 제공합니다. 현재 현황은 최종 리포트 점수나 무임승차 판정이 아닙니다.
            </p>
          </>
        )}
      </ResourceState>
    </section>
  );
}
