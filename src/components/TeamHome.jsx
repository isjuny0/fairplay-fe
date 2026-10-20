import Icon from './Icon.jsx';
import '../team-home-restored.css';
import { Check, ChartNoAxesCombined, ClipboardCheck } from 'lucide-react';
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
    <section className="stack team-home team-home-visual team-home-restored">
      <div className="page-heading">
        <div>
          <span className="home-eyebrow">OUR WORKSPACE</span>
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
            내 작업 확인 <Icon name="arrow" />
          </button>
        </div>
      </div>
      <ResourceState resource={resource} label="본인 작업 현황">
        {summary && (
          <>
            <div className="team-home-summary home-visual-summary">
              <section className="home-team-progress" aria-label="팀 진행 현황">
                <div className="home-progress-title">
                  <span className="home-eyebrow">조금씩, 함께 앞으로</span>
                  <h2>팀 전체 진행률</h2>
                  <span>현재 등록된 작업 기준</span>
                </div>
                <TeamProgressRing value={summary.teamProgressRate} />
                <ProgressBar
                  value={summary.teamProgressRate}
                  label="예상 작업량을 반영한 팀 진행 막대"
                />
                <span className="home-progress-footnote">
                  예상 작업량을 반영한 값 · 최종 기여도와 달라요
                </span>
              </section>
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
                  <Icon name="clock" />
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
                      <Icon name="calendar" />
                    </span>
                    <span className="home-action-content">
                      <span className="home-action-title">
                        <span>내 마감 지연</span>
                        <strong>{summary.myOverdueTaskCount}건</strong>
                      </span>
                    </span>
                    <Icon name="arrow" />
                  </button>
                </div>
                {summary.myOverdueTaskCount === 0 && (
                  <span className="home-all-clear">
                    <Check size={14} aria-hidden="true" />
                    확인할 작업 없음
                  </span>
                )}
                {summary.myOverdueTaskCount > 0 && (
                  <span className="home-action-help">
                    지연된 담당 작업을 확인하세요.
                  </span>
                )}
              </section>
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
                <span className="home-shortcut-copy">
                  <strong>협업을 돌아볼 시간</strong>
                  <small>동료 평가 작성</small>
                </span>
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
                <span className="home-shortcut-copy">
                  <strong>함께 만든 결과</strong>
                  <small>공개 리포트 보기</small>
                </span>
                <Icon name="arrow" />
              </button>
            </nav>
            <div className="home-insights">
              <section
                className="own-work-panel home-my-work"
                aria-label="본인 작업 현황"
              >
                <div className="section-heading home-metric-heading">
                  <div>
                    <span className="home-eyebrow">나의 참여를 한눈에</span>
                    <h2>내 작업 현황</h2>
                  </div>
                  <Icon name="chart" />
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
              <details className="home-metric-help home-definitions">
                <summary className="home-definition-heading">
                  <div>
                    <h2>지표 계산 기준</h2>
                    <p>각 비율의 의미와 계산 방법</p>
                  </div>
                  <span className="home-definition-toggle">
                    <span className="when-closed">펼쳐보기</span>
                    <span className="when-open">접기</span>
                    <Icon name="arrow" />
                  </span>
                </summary>
                <div className="home-definition-body">
                  <p>
                    작업 개수가 아닌 <strong>예상 작업량</strong>을 기준으로
                    계산해요. 아래의 ‘분량’은 예상 작업량을 뜻하며, 내 분량에는
                    공동 작업의 담당 비율도 반영합니다.
                  </p>
                  <dl>
                    <div>
                      <dt>팀 전체 진행률</dt>
                      <dd>
                        <span>팀 전체 일 중 얼마나 끝났는지</span>
                        <small>팀 완료 분량 ÷ 팀 전체 분량 × 100</small>
                      </dd>
                    </div>
                    <div>
                      <dt>내 담당 비중</dt>
                      <dd>
                        <span>팀 전체 일 중 내가 맡은 몫</span>
                        <small>내 담당 분량 ÷ 팀 전체 분량 × 100</small>
                      </dd>
                    </div>
                    <div>
                      <dt>내 완료 비중</dt>
                      <dd>
                        <span>팀 전체 일 중 내가 완료한 몫</span>
                        <small>내 완료 분량 ÷ 팀 전체 분량 × 100</small>
                      </dd>
                    </div>
                    <div>
                      <dt>내 작업 완료율</dt>
                      <dd>
                        <span>내가 맡은 일 중 얼마나 끝냈는지</span>
                        <small>내 완료 분량 ÷ 내 담당 분량 × 100</small>
                      </dd>
                    </div>
                  </dl>
                  <ul>
                    <li>
                      <strong>완료 기준</strong> · ‘완료’ 상태의 작업만
                      포함하며, 완료 후 ‘수정 중’인 작업은 제외해요.
                    </li>
                    <li>
                      <strong>계산할 분량이 없을 때</strong> · 0% 대신 ‘계산할
                      작업 없음’ 또는 ‘담당 작업 없음’으로 표시해요.
                    </li>
                    <li>
                      <strong>마감 지연</strong> · 마감이 지난 내 할 일·진행
                      중·수정 중 작업이에요.
                    </li>
                  </ul>
                  <div className="home-definition-warning">
                    현재 작업 현황을 보여주는 지표예요. 실제 소요 시간이나 최종
                    기여도 점수, 무임승차 여부를 뜻하지 않아요.
                  </div>
                </div>
              </details>
            </div>
          </>
        )}
      </ResourceState>
    </section>
  );
}
