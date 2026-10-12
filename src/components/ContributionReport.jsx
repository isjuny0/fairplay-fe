import { useState } from 'react';
import {
  getTeamReport,
  getRounds,
  requestPlanned,
} from '../api/planned.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { formatDate } from '../lib/domain.js';
import { MockNotice, ProgressBar } from './PlanningUi.jsx';
import { EmptyState, ErrorNotice, Modal, ResourceState } from './ui.jsx';

function ReportDetail({ context, report }) {
  return (
    <div className="stack">
      {report.myDetails && (
        <section className="report-own-result">
          <div>
            <span className="eyebrow">공개된 나의 최종 결과</span>
            <h2>나의 최종 기여율</h2>
            <p className="field-help">
              현재 작업 현황과 구분된 최종 평가 결과입니다.
            </p>
          </div>
          <strong>
            {Number(report.myDetails.totalPercent).toFixed(1)}%
          </strong>
        </section>
      )}
      <section className="panel">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              {report.status === 'PUBLISHED'
                ? '공개된 최종 결과'
                : '관리자 검토용 비공개 리포트'}
            </span>
            <h2>팀 기여도 리포트</h2>
            <p>
              {report.status === 'PUBLISHED'
                ? `공개 ${formatDate(report.publishedAt)}`
                : '팀원에게 공개되지 않았습니다.'}
            </p>
          </div>
          <span className="status-badge task-state-done">
            {report.status === 'PUBLISHED' ? '공개' : '비공개'}
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
      <details className="panel report-method">
        <summary>계산 방식 보기</summary>
        <h2>어떻게 계산되나요?</h2>
        <div
          className="report-composition"
          aria-label="AI 작업 평가 70%, 중간 동료 평가 10%, 최종 동료 평가 20%"
        >
          <span style={{ width: '70%' }}>70%</span>
          <span style={{ width: '10%' }}>10%</span>
          <span style={{ width: '20%' }}>20%</span>
        </div>
        <ul className="clean-list composition-legend">
          <li>AI 작업 평가 70% · 유효한 작업 품질과 담당 배분</li>
          <li>중간 동료 평가 10% · 팀 내 협업 평가 비율</li>
          <li>최종 동료 평가 20% · 팀 내 협업 평가 비율</li>
        </ul>
        <p className="field-help">
          작업 집계 기준 {formatDate(report.cutoffAt)}. 평가자·개별 동료
          점수·사유 원문은 공개하지
          않습니다.
        </p>
      </details>
      {report.myDetails && (
        <details className="panel report-calculation">
          <summary>나의 계산 근거 보기</summary>
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
                  ['중간 동료 평가', 'mid', 10],
                  ['최종 동료 평가', 'final', 20],
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
          <p className="field-help">
            기여분은 최종 기여율에 더해지는 퍼센트포인트(%p)입니다. 예: 팀
            내 비율 80%에 반영 비중 70%를 곱하면 최종 기여율에 56%p가
            반영됩니다.
          </p>
        </details>
      )}
    </div>
  );
}
export function TeamReport({ context, manager = false }) {
  const { notify } = useInteractions();
  const readiness = useResource(async () => {
    if (!manager) return null;
    const [rounds, dashboard] = await Promise.all([
      getRounds(context),
      requestPlanned(
        context,
        `/api/spaces/${context.space.id}/manager-dashboard`,
      ),
    ]);
    return { rounds, dashboard };
  }, [manager, context.space.id, context.team.id]);
  const resource = useResource(
    () => getTeamReport(context),
    [context.team.id, context.user.id],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [publishing, setPublishing] = useState(null);
  const selected = resource.data;
  const closedRounds =
    readiness.data &&
    ['MID', 'FINAL'].every((type) =>
      readiness.data.rounds.some(
        (round) => round.type === type && round.status === 'CLOSED',
      ),
    );
  const teamSubmissionComplete =
    readiness.data &&
    ['MID', 'FINAL'].every(
      (type) =>
        readiness.data.dashboard.missingPeerSubmissions
          .find((round) => round.type === type)
          ?.teams.find((team) => team.teamId === context.team.id)
          ?.missingCount === 0,
    );
  const aiReviewCount = readiness.data?.dashboard.teams.find(
    (team) => team.teamId === context.team.id,
  )?.aiNeedsReviewCount;
  const knownBlock =
    readiness.loading ||
    Boolean(readiness.error) ||
    !closedRounds ||
    !teamSubmissionComplete ||
    context.team.approvedMemberCount < 2 ||
    aiReviewCount > 0;
  return (
    <div className="stack">
      <ErrorNotice error={error} />
      {manager && (
        <section className="panel">
          <ol className="process-steps" aria-label="리포트 진행 단계">
            <li className={!selected ? 'active' : ''}>1. 리포트 생성</li>
            <li className={selected?.status === 'UNPUBLISHED' ? 'active' : ''}>
              2. 검토
            </li>
            <li className={selected?.status === 'PUBLISHED' ? 'active' : ''}>
              3. 공개
            </li>
          </ol>
          <ul className="readiness-list">
            <li>{closedRounds ? '✓' : '○'} 중간·최종 평가 마감</li>
            <li>
              {teamSubmissionComplete ? '✓' : '○'} 우리 팀 필수 동료 평가 제출
            </li>
            <li>
              {aiReviewCount == null
                ? '확인 중'
                : `AI 추가 확인 ${aiReviewCount}건`}{' '}
              · 모든 AI 입력의 유효성은 리포트 생성 시 최종 확인
            </li>
          </ul>
          <ErrorNotice error={readiness.error} onRetry={readiness.reload} />
          <div className="page-heading">
            <div>
              <h2>{context.team.name} 리포트</h2>
              <p>
                유효 AI 평가와 우리 팀 중간·최종 평가 제출을 충족하면 현재
                산식으로 계산합니다.
              </p>
            </div>
            <button
              className={selected ? 'secondary-button' : 'primary-button'}
              disabled={busy || knownBlock || Boolean(selected)}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await requestPlanned(
                    context,
                    `/api/teams/${context.team.id}/report`,
                    { method: 'POST' },
                  );
                  notify('리포트를 생성했습니다.');
                  resource.reload();
                } catch (error) {
                  setError(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {selected ? '생성 완료' : '리포트 생성'}
            </button>
          </div>
          <p className="field-help">
            확정된 입력으로 한 번 생성한 결과를 검토하고 공개합니다.
            생성된 계산 결과는 변경할 수 없습니다.
          </p>
        </section>
      )}
      <ResourceState resource={resource}>
        {selected ? (
          <>
            {selected && (
              <ReportDetail
                context={context}
                report={selected}
              />
            )}
            {manager && selected?.status === 'UNPUBLISHED' && (
              <section className="panel">
                <h2>검토 후 팀원에게 공개</h2>
                <p>
                  스페이스 전체 중간·최종 평가 필수 제출 완료가 필요합니다. 공개 결과는 불변입니다.
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
                ? '평가와 유효 AI 입력이 준비되면 팀별 리포트를 생성해 주세요.'
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
            {context.team.name}의 검토한 결과를 공개합니다.
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
                  notify('리포트를 팀원에게 공개했습니다.');
                  resource.reload();
                  readiness.reload();
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
      <TeamReport context={context} />
    </section>
  );
}
