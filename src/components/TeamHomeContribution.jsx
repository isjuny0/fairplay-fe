import { ArrowUpRight } from 'lucide-react';
import Icon from './Icon.jsx';
import DashboardMetricHelp from './DashboardMetricHelp.jsx';
import { ResourceState } from './ui.jsx';
import { formatReportNumber } from '../lib/reportScore.js';
import { reportWeightFields, validReportWeights } from '../lib/reportWeights.js';

export default function TeamHomeContribution({ resource, userId, onNavigate }) {
  const report = resource.data?.status === 'PUBLISHED' ? resource.data : null;
  const weights = validReportWeights(report?.weights) ? report.weights : null;
  const value =
    report?.members?.find((member) => member.userId === userId)?.totalScore;
  return (
    <section
      className="dashboard-card dashboard-contribution"
      aria-label="내 기여도"
    >
      <header className="dashboard-card-heading">
        <div className="dashboard-title">
          <span className="dashboard-icon">
            <Icon name="chart" />
          </span>
          <h2>내 기여도</h2>
          <DashboardMetricHelp title="내 기여도" contribution weights={weights} />
        </div>
      </header>
      <ResourceState resource={resource} label="내 기여도">
        <div className="dashboard-contribution-result">
          <span className="dashboard-tag">
            {report ? '공개된 최종 결과' : '공개 대기'}
          </span>
          <strong>{value == null ? '—' : `${formatReportNumber(value)}점`}</strong>
          <p>
            {report
              ? value == null
                ? '리포트에 내 종합점수가 없습니다.'
                : '개인별 100점 만점 종합 평가'
              : '리포트가 공개되면 확인할 수 있어요.'}
          </p>
        </div>
        {weights && <div className="dashboard-contribution-composition" aria-hidden="true">
          {reportWeightFields.map(({ key }) => <span key={key} style={{ flex: weights[key], display: weights[key] === 0 ? 'none' : undefined }} />)}
        </div>}
        <p className="dashboard-caption">{weights ? `작업 점수 ${weights.taskPercent}% · 중간 ${weights.midPercent}% · 최종 ${weights.finalPercent}%` : '반영 비율은 공개된 리포트에서 확인할 수 있습니다.'}</p>
        <button
          type="button"
          className="dashboard-shortcut-button"
          onClick={() => onNavigate('기여도 리포트')}
        >
          리포트 보기 <ArrowUpRight size={15} />
        </button>
      </ResourceState>
    </section>
  );
}
