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
          <span className="eyebrow">우리 팀의 작업 공간</span>
          <h1>{context.team.name}</h1>
          <p>팀의 진행 상황과 내가 맡은 작업을 확인하세요.</p>
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
      <ResourceState resource={resource}>
        {summary && (
          <>
            <div className="team-home-summary">
              <section
                className="panel own-work-panel"
                aria-label="본인 작업 현황"
              >
                <h2>본인 작업 현황</h2>
                <div className="section-heading home-summary-context">
                  <p className="field-help">
                    현재 등록된 작업의 예상 작업량과 담당 비율을 기준으로
                    계산합니다.
                  </p>
                  {summary.asOf && (
                    <time dateTime={summary.asOf}>
                      조회 기준 {formatDate(summary.asOf)}
                    </time>
                  )}
                </div>
                <div className="metric-grid three">
                  <MetricCard
                    accent
                    label="팀 전체 작업 중 내 담당 비중"
                    value={formatPercent(summary.myAssignedShare)}
                    description="예상 작업량과 담당 비율을 반영한 내 몫"
                  />
                  <MetricCard
                    label="팀 전체 작업 중 내 완료 비중"
                    value={formatPercent(summary.myCompletedContributionRate)}
                    description="예상 작업량과 담당 비율을 반영한 내 완료 분량"
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
              </section>
              <section className="panel next-action-panel">
                <h2>지금 확인할 작업</h2>
                <div className="action-summary">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      onNavigate('작업', {
                        mine: '1',
                        status: 'PENDING_APPROVAL',
                      })
                    }
                  >
                    <span>내 승인 대기</span>
                    <strong>{summary.myPendingApprovalCount}건</strong>
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      onNavigate('작업', {
                        mine: '1',
                        overdue: 'work',
                        view: 'list',
                      })
                    }
                  >
                    <span>내 마감 지연</span>
                    <strong>{summary.myOverdueTaskCount}건</strong>
                  </button>
                </div>
                <p className="field-help">
                  마감 지연은 할 일·진행 중인 내 작업만 집계합니다. 승인 대기
                  중인 작업은 제외합니다.
                </p>
              </section>
              <section className="panel progress-panel">
                <div>
                  <span className="eyebrow">현재 등록된 작업 기준</span>
                  <h2>팀 전체 진행률</h2>
                  <p>
                    예상 작업량을 반영한 진행률입니다. 실제 소요 시간이나 최종
                    기여도 점수가 아닙니다.
                  </p>
                </div>
                <strong className="hero-number">
                  {formatPercent(summary.teamProgressRate)}
                </strong>
                <ProgressBar
                  value={summary.teamProgressRate}
                  label="예상 작업량을 반영한 팀 진행률"
                />
              </section>
            </div>
            <section className="panel collaboration-panel">
              <h2>함께 완성하는 과정</h2>
              <p>
                작업을 기록하고, 협업을 돌아보고, 공개된 최종 결과를 확인하세요.
              </p>
              <div className="collaboration-navigation">
                <button
                  className="collaboration-link"
                  aria-label="동료 평가 작성"
                  onClick={() => onNavigate('동료 평가')}
                >
                  <span>
                    <strong>동료 평가 작성</strong>
                    <small>
                      팀원의 수행 행동을 돌아보고 평가를 제출하세요.
                    </small>
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
                    <small>
                      관리자가 공개한 결과와 본인의 계산 근거를 확인하세요.
                    </small>
                  </span>
                  <Icon name="arrow" />
                </button>
              </div>
            </section>
            <p className="field-help">
              본인의 작업 현황만 제공합니다. 현재 현황은 최종 리포트 점수나
              무임승차 판정이 아닙니다.
            </p>
          </>
        )}
      </ResourceState>
    </section>
  );
}
