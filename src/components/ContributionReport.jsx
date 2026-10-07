import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { getReport, getReports, requestPlanned } from '../api/planned.js';
import useResource from '../hooks/useResource.js';
import { formatDate } from '../lib/domain.js';
import { parseRouteId } from '../lib/routes.js';
import { MetricCard, MockNotice, ProgressBar } from './PlanningUi.jsx';
import { EmptyState, ErrorNotice, Modal, ResourceState } from './ui.jsx';

function ReportDetail({ context, reportId }) {
  const resource = useResource(
    () => getReport(context, reportId),
    [reportId, context.user.id],
  );
  const report = resource.data;
  return (
    <ResourceState resource={resource}>
      {report && (
        <div className="stack">
          <section className="panel">
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {report.status === 'PUBLISHED'
                    ? '공개된 최종 결과'
                    : '관리자 검토용 초안'}
                </span>
                <h2>팀 기여도 리포트 · v{report.version}</h2>
                <p>
                  {report.status === 'PUBLISHED'
                    ? `공개 ${formatDate(report.publishedAt)}`
                    : '팀원에게 공개되지 않았습니다.'}
                </p>
              </div>
              <span className="status-badge task-state-done">
                {report.status === 'PUBLISHED' ? '공개' : '초안'}
              </span>
            </div>
            {report.members.map((member) => (
              <div className="report-member" key={member.userId}>
                <div>
                  <strong>
                    {member.name}
                    {member.userId === context.user.id && ' · 나'}
                  </strong>
                  <span>{Number(member.contributionPercent).toFixed(1)}%</span>
                </div>
                <ProgressBar
                  value={member.contributionPercent}
                  label={`${member.name} 최종 기여율`}
                />
              </div>
            ))}
            <p className="field-help">
              최종 기여율 합계 {Number(report.totalPercent).toFixed(1)}% · 팀
              홈의 현재 작업 현황과는 다른 집계입니다.
            </p>
          </section>
          <section className="panel">
            <h2>어떻게 계산되나요?</h2>
            <div className="metric-grid three">
              <MetricCard
                label="AI 작업 평가"
                value="70%"
                description="유효한 작업 품질 평가와 담당 배분"
              />
              <MetricCard
                label="중간 동료 평가"
                value="10%"
                description="MID 수신 평가의 팀 내 비율"
              />
              <MetricCard
                label="최종 동료 평가"
                value="20%"
                description="FINAL 수신 평가의 팀 내 비율"
              />
            </div>
            <p className="field-help">
              작업 집계 기준 {formatDate(report.cutoffAt)} · 정책{' '}
              {report.policyVersion}. 평가자·개별 동료 점수·사유 원문은 공개하지
              않습니다.
            </p>
          </section>
          {report.myDetails && (
            <section className="panel">
              <h2>나의 계산 근거</h2>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>구성 요소</th>
                      <th>팀 내 비율</th>
                      <th>반영 비중</th>
                      <th>기여분</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['AI 작업 평가', 'ai', 70],
                      ['MID', 'mid', 10],
                      ['FINAL', 'final', 20],
                    ].map(([label, key, weight]) => (
                      <tr key={key}>
                        <th>{label}</th>
                        <td>
                          {Number(
                            report.myDetails[`${key}RatioPercent`],
                          ).toFixed(1)}
                          %
                        </td>
                        <td>{weight}%</td>
                        <td>
                          {Number(
                            report.myDetails[`${key}ContributionPercent`],
                          ).toFixed(1)}
                          %p
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                반올림 보정 {report.myDetails.roundingAdjustmentPercent}%p ·
                최종 {Number(report.myDetails.totalPercent).toFixed(1)}%
              </p>
            </section>
          )}
        </div>
      )}
    </ResourceState>
  );
}
export function ReportList({ context, manager = false }) {
  const resource = useResource(
    () => getReports(context),
    [context.team.id, context.user.id],
  );
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [publishing, setPublishing] = useState(null);
  const reports = resource.data || [];
  const selected =
    reports.find(
      (report) => report.id === parseRouteId(params.get('reportId')),
    ) || reports[0];
  const select = (id) => {
    const next = new URLSearchParams(params);
    next.set('reportId', String(id));
    setParams(next);
  };
  return (
    <div className="stack">
      <ErrorNotice error={error} />
      {manager && (
        <section className="panel">
          <div className="page-heading">
            <div>
              <h2>{context.team.name} 리포트</h2>
              <p>
                유효 AI 평가와 우리 팀 MID·FINAL 제출을 충족하면 현재 산식으로
                계산합니다.
              </p>
            </div>
            <button
              className="primary-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const report = await requestPlanned(
                    context,
                    `/api/teams/${context.team.id}/reports/draft`,
                    { method: 'POST' },
                  );
                  select(report.id);
                  resource.reload();
                } catch (error) {
                  setError(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              초안 생성
            </button>
          </div>
          <p className="field-help">
            같은 입력이면 기존 리포트를 재사용합니다. 점수를 수동으로 변경하는
            기능은 없습니다.
          </p>
        </section>
      )}
      <ResourceState resource={resource}>
        {reports.length ? (
          <>
            <div className="round-tabs" role="group" aria-label="리포트 선택">
              {reports.map((report) => (
                <button
                  className={selected?.id === report.id ? 'active' : ''}
                  aria-pressed={selected?.id === report.id}
                  key={report.id}
                  onClick={() => select(report.id)}
                >
                  <strong>v{report.version}</strong>
                  <span>{report.status === 'PUBLISHED' ? '공개' : '초안'}</span>
                </button>
              ))}
            </div>
            {selected && (
              <ReportDetail
                key={`${selected.id}-${selected.status}`}
                context={context}
                reportId={selected.id}
              />
            )}
            {manager && selected?.status === 'DRAFT' && (
              <section className="panel">
                <h2>검토 후 팀원에게 공개</h2>
                <p>
                  스페이스 전체 MID·FINAL 필수 제출과 최신 입력 조건이
                  필요합니다. 공개 결과는 불변입니다.
                </p>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => setPublishing(selected)}
                >
                  리포트 공개
                </button>
              </section>
            )}
          </>
        ) : (
          <EmptyState>
            <h2>
              {manager
                ? '생성된 리포트가 없습니다.'
                : '공개된 리포트가 없습니다.'}
            </h2>
            <p>
              {manager
                ? '평가와 유효 AI 입력이 준비되면 팀별 초안을 생성해 주세요.'
                : '관리자가 최종 결과를 검토하고 공개하면 이곳에서 확인할 수 있습니다.'}
            </p>
          </EmptyState>
        )}
      </ResourceState>
      {publishing && (
        <Modal
          title="기여도 리포트 공개"
          busy={busy}
          onClose={() => setPublishing(null)}
        >
          <p>
            {context.team.name}의 v{publishing.version} 결과를 공개합니다.
            팀원은 전체 최종 비율과 자신의 계산 근거를 보게 됩니다.
          </p>
          <ErrorNotice error={error} />
          <div className="heading-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setPublishing(null)}
            >
              취소
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await requestPlanned(
                    context,
                    `/api/reports/${publishing.id}/publish`,
                    { method: 'POST' },
                  );
                  setPublishing(null);
                  resource.reload();
                } catch (error) {
                  setError(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              공개 확정
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function ContributionReport({ context }) {
  return (
    <section className="stack">
      <div>
        <span className="eyebrow">함께 만든 최종 결과</span>
        <h1>기여도 리포트</h1>
        <p>관리자가 공개한 팀 결과와 본인의 계산 근거를 확인하세요.</p>
      </div>
      <MockNotice />
      <ReportList context={context} />
    </section>
  );
}
