import Icon from './Icon.jsx';
import {
  Check,
  Hourglass,
  ChartNoAxesCombined,
  ClipboardCheck,
} from 'lucide-react';
import { formatDate } from '../lib/domain.js';
import useResource from '../hooks/useResource.js';
import { getMyWorkSummary } from '../api/teams.js';
import { formatPercent } from '../lib/evaluation.js';
import { ResourceState } from './ui.jsx';
import { ProgressBar } from './PlanningUi.jsx';

function TeamProgressRing({ value }) {
  const available = value != null;
  const percent = available ? Math.min(100, Math.max(0, Number(value))) : 0;
  return (
    <div
      className={`home-progress-ring ${available ? '' : 'is-empty'}`}
      role="progressbar"
      aria-label="예상 작업량을 반영한 팀 진행률"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={available ? percent : undefined}
      aria-valuetext={available ? undefined : '계산할 작업 없음'}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="home-ring-track" cx="60" cy="60" r="50" />
        <circle
          className="home-ring-value"
          cx="60"
          cy="60"
          r="50"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - percent}
          strokeOpacity={percent > 0 ? 1 : 0}
        />
      </svg>
      <div>
        <strong>{available ? formatPercent(value) : '—'}</strong>
        {!available && <small>계산할 작업 없음</small>}
      </div>
    </div>
  );
}

function WorkMetric({ label, scope, value, empty, tone }) {
  return (
    <article className={`home-work-metric ${tone}`}>
      <span className="home-metric-scope">{scope}</span>
      <h3>{label}</h3>
      <strong className={value == null ? 'is-empty' : ''}>
        {formatPercent(value, empty)}
      </strong>
      <ProgressBar value={value} label={`${label} · ${scope}`} />
    </article>
  );
}

export default function TeamHome({ context, onNavigate }) {
  const resource = useResource(
    () => getMyWorkSummary(context.team.id),
    [context.team.id, context.user.id],
  );
  const summary = resource.data;
  return (
    <section className="stack team-home team-home-visual">
      <div className="page-heading">
        <div>
          <h1>{context.team.name}</h1>
        </div>
        <div className="heading-actions">
          <button
            className="secondary-button"
            aria-label="현황 새로고침"
            title="현황 새로고침"
            disabled={resource.loading}
            onClick={resource.reload}
          >
            <Icon name="refresh" />
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
            <div className="team-home-summary home-visual-summary">
              <section
                className="next-action-panel home-actions"
                aria-label="지금 확인할 작업"
              >
                <div className="section-heading home-summary-context">
                  <h2>지금 확인할 작업</h2>
                  {summary.asOf && (
                    <time dateTime={summary.asOf}>
                      {formatDate(summary.asOf)} 기준
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
                    <span
                      className="home-action-icon home-overdue-icon"
                      aria-hidden="true"
                    >
                      <Icon name="clock" />
                    </span>
                    <span className="home-action-content">
                      <span className="home-action-title">
                        <span>내 마감 지연</span>
                        <strong>{summary.myOverdueTaskCount}건</strong>
                      </span>
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
                    <span
                      className="home-action-icon home-pending-icon"
                      aria-hidden="true"
                    >
                      <Hourglass size={20} />
                    </span>
                    <span className="home-action-content">
                      <span className="home-action-title">
                        <span>내 승인 대기</span>
                        <strong>{summary.myPendingApprovalCount}건</strong>
                      </span>
                    </span>
                    <Icon name="arrow" />
                  </button>
                </div>
                {summary.myOverdueTaskCount === 0 &&
                  summary.myPendingApprovalCount === 0 && (
                    <span className="home-all-clear">
                      <Check size={14} aria-hidden="true" />
                      확인할 작업 없음
                    </span>
                  )}
              </section>
              <div className="home-overview-grid">
                <section
                  className="progress-panel home-team-progress"
                  aria-label="팀 진행 현황"
                >
                  <div className="home-progress-title">
                    <h2>팀 전체 진행률</h2>
                    <span>예상 작업량 기준</span>
                  </div>
                  <TeamProgressRing value={summary.teamProgressRate} />
                </section>
                <section
                  className="own-work-panel home-my-work"
                  aria-label="본인 작업 현황"
                >
                  <div className="section-heading home-metric-heading">
                    <h2>내 작업 현황</h2>
                  </div>
                  <div className="home-work-metrics">
                    <WorkMetric
                      label="내 담당 비중"
                      scope="팀 전체 기준"
                      value={summary.myAssignedShare}
                      tone="assigned"
                    />
                    <WorkMetric
                      label="내 완료 비중"
                      scope="팀 전체 기준"
                      value={summary.myCompletedContributionRate}
                      tone="completed"
                    />
                    <WorkMetric
                      label="내 작업 완료율"
                      scope="내 담당 기준"
                      value={summary.myTaskCompletionRate}
                      empty={
                        summary.teamTotalWeight
                          ? '담당 작업 없음'
                          : '계산할 작업 없음'
                      }
                      tone="completion"
                    />
                  </div>
                </section>
              </div>
            </div>
            <nav className="home-quick-links" aria-label="평가·리포트">
              <button
                className="home-quick-link"
                aria-label="동료 평가 작성"
                onClick={() => onNavigate('동료 평가')}
              >
                <span className="home-quick-icon" aria-hidden="true">
                  <ClipboardCheck size={20} />
                </span>
                <strong>동료 평가 작성</strong>
                <Icon name="arrow" />
              </button>
              <button
                className="home-quick-link"
                aria-label="공개 리포트 보기"
                onClick={() => onNavigate('기여도 리포트')}
              >
                <span className="home-quick-icon" aria-hidden="true">
                  <ChartNoAxesCombined size={20} />
                </span>
                <strong>공개 리포트 보기</strong>
                <Icon name="arrow" />
              </button>
            </nav>
            <details className="home-metric-help home-definitions">
              <summary>
                지표 계산 기준<span>현재 작업 현황 · 최종 기여도와 다름</span>
              </summary>
              <div className="home-definition-body">
                <p>
                  예상 작업량을 반영한 진행률입니다. 현재 등록된 작업의 예상
                  작업량과 담당 비율을 사용하며 실제 소요 시간을 나타내지
                  않습니다.
                </p>
                <dl>
                  <div>
                    <dt>팀 전체 진행률</dt>
                    <dd>팀 완료 분량 ÷ 팀 전체 분량 × 100</dd>
                  </div>
                  <div>
                    <dt>내 담당 비중</dt>
                    <dd>내 담당 분량 ÷ 팀 전체 분량 × 100</dd>
                  </div>
                  <div>
                    <dt>내 완료 비중</dt>
                    <dd>내 완료 분량 ÷ 팀 전체 분량 × 100</dd>
                  </div>
                  <div>
                    <dt>내 작업 완료율</dt>
                    <dd>내 완료 분량 ÷ 내 담당 분량 × 100</dd>
                  </div>
                </dl>
                <ul>
                  <li>
                    계산할 분량이 없으면 ‘계산할 작업 없음’ 또는 ‘담당 작업
                    없음’으로 표시합니다.
                  </li>
                  <li>
                    마감 지연은 할 일·진행 중인 내 작업만 집계하며 승인 대기
                    작업은 제외합니다.
                  </li>
                  <li>승인 대기는 내가 담당한 작업의 승인 대기 건수입니다.</li>
                </ul>
                <div className="home-definition-warning">
                  본인의 작업 현황만 제공합니다. 현재 현황은 최종 리포트 점수나
                  무임승차 판정이 아닙니다.
                </div>
              </div>
            </details>
          </>
        )}
      </ResourceState>
    </section>
  );
}
