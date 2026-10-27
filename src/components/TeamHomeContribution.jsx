import { ArrowUpRight } from 'lucide-react';
import Icon from './Icon.jsx';
import DashboardMetricHelp from './DashboardMetricHelp.jsx';
import { ResourceState } from './ui.jsx';
import { formatPercent } from '../lib/evaluation.js';
import { reportWeightFields, validReportWeights } from '../lib/reportWeights.js';

export default function TeamHomeContribution({ resource, userId, onNavigate }) {
  const report = resource.data?.status === 'PUBLISHED' ? resource.data : null;
  const weights = validReportWeights(report?.weights) ? report.weights : null;
  const value =
    report?.myDetails?.totalPercent ??
    report?.members?.find((member) => member.userId === userId)
      ?.contributionPercent;
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
          <strong>{value == null ? '—' : formatPercent(value)}</strong>
          <p>
            {report
              ? value == null
                ? '리포트에 내 기여율이 없습니다.'
                : '팀에서 함께 만든 결과 속 나의 몫'
              : '리포트가 공개되면 확인할 수 있어요.'}
          </p>
        </div>
        {weights && <div className="dashboard-contribution-composition" aria-hidden="true">
          {reportWeightFields.map(({ key }) => <span key={key} style={{ flex: weights[key], display: weights[key] === 0 ? 'none' : undefined }} />)}
        </div>}
        <p className="dashboard-caption">{weights ? `완료 작업 ${weights.taskPercent}% · 동료 평가 ${weights.midPercent + weights.finalPercent}%` : '반영 비율은 공개된 리포트에서 확인할 수 있습니다.'}</p>
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
