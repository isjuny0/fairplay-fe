import { useState } from 'react';
import {
  getTeamReport,
  generateTeamReport,
  publishReport,
} from '../api/reports.js';
import { listEvaluationRounds } from '../api/evaluations.js';
import { getManagerDashboard } from '../api/dashboard.js';
import ManagerPeerResponses from './ManagerPeerResponses.jsx';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { spacePath } from '../lib/routes.js';
import { roundLabels, roundStatusLabels } from '../lib/evaluation.js';
import { formatDate } from '../lib/domain.js';
import { ProgressBar } from './PlanningUi.jsx';
import { EmptyState, ErrorNotice, Modal, ResourceState } from './ui.jsx';

function CalculationDetails({ name, details }) {
  return (
    <details className="panel report-calculation">
      <summary>{name} 계산 근거 보기</summary>
      <h2>{name} 계산 근거</h2>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">{name} 최종 기여율 계산 근거</caption>
          <thead>
            <tr>
              <th scope="col">구성 요소</th>
              <th scope="col">팀 내 비율</th>
              <th scope="col">반영 비중</th>
              <th scope="col">기여분</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['완료 작업', 'task', 70],
              ['중간 동료 평가', 'mid', 10],
              ['최종 동료 평가', 'final', 20],
            ].map(([label, key, weight]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td>{Number(details[`${key}RatioPercent`]).toFixed(1)}%</td>
                <td>{weight}%</td>
                <td>
                  {Number(details[`${key}ContributionPercent`]).toFixed(1)}
                  %p
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        반올림 보정 {details.roundingAdjustmentPercent}%p · 최종{' '}
        {Number(details.totalPercent).toFixed(1)}%
      </p>
      <p className="field-help">
        기여분은 최종 기여율에 더해지는 퍼센트포인트(%p)입니다. 예: 팀 내 비율
        80%에 반영 비중 70%를 곱하면 최종 기여율에 56%p가 반영됩니다.
      </p>
    </details>
  );
}
function ReportDetail({ context, report }) {
  return (
    <div className="stack report-result">
      {report.myDetails && (
        <section className="report-own-result">
          <div>
            <span className="eyebrow">공개된 나의 최종 결과</span>
            <h2>나의 최종 기여율</h2>
            <p className="field-help">
              현재 작업 현황과 구분된 최종 평가 결과입니다.
            </p>
          </div>
          <strong>{Number(report.myDetails.totalPercent).toFixed(1)}%</strong>
        </section>
      )}
      <section className="panel report-team-result">
        <div className="section-heading">
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
          <span
            className={`status-badge ${report.status === 'PUBLISHED' ? 'task-state-done' : 'task-state-todo'}`}
          >
            {report.status === 'PUBLISHED' ? '공개' : '비공개'}
          </span>
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="팀 최종 기여율"
          tabIndex={0}
        >
          <table className="data-table report-results-table">
            <caption className="sr-only">팀원별 최종 기여율</caption>
            <thead>
              <tr>
                <th scope="col">팀원</th>
                <th scope="col">최종 기여율</th>
                <th scope="col">팀 내 비율</th>
              </tr>
            </thead>
            <tbody>
              {report.members.map((member) => (
                <tr
                  className={
                    member.userId === context.user.id
                      ? 'report-current-member'
                      : ''
                  }
                  key={member.userId}
                >
                  <th scope="row">
                    {member.name}
                    {member.userId === context.user.id && (
                      <span className="report-self-label">나</span>
                    )}
                  </th>
                  <td>{Number(member.contributionPercent).toFixed(1)}%</td>
                  <td>
                    <ProgressBar
                      value={member.contributionPercent}
                      label={`${member.name} 최종 기여율`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-help">
          최종 기여율 합계 {Number(report.totalPercent).toFixed(1)}% · 팀 홈의
          현재 작업 현황과는 다른 집계입니다.
        </p>
      </section>
      <details className="panel report-method">
        <summary>계산 방식 보기</summary>
        <h2>어떻게 계산되나요?</h2>
        <div
          className="report-composition"
          aria-label="완료 작업 70%, 중간 동료 평가 10%, 최종 동료 평가 20%"
        >
          <span style={{ width: '70%' }}>70%</span>
          <span style={{ width: '10%' }}>10%</span>
          <span style={{ width: '20%' }}>20%</span>
        </div>
        <ul className="clean-list composition-legend">
          <li>완료 작업 70% · 최종 평가 마감까지 완료된 예상 작업량과 담당 배분</li>
          <li>중간 동료 평가 10% · 팀 내 협업 평가 비율</li>
          <li>최종 동료 평가 20% · 팀 내 협업 평가 비율</li>
          <li>수정 중인 작업은 완료 분량에서 제외합니다.</li>
        </ul>
        <p className="field-help">
          작업 집계 기준 {formatDate(report.cutoffAt)}. 평가자·개별 동료
          점수·사유 원문은 공개하지 않습니다.
        </p>
      </details>
      {report.myDetails && (
        <CalculationDetails name="나의" details={report.myDetails} />
      )}
      {context.manager &&
        report.members
          .filter((member) => member.details)
          .map((member) => (
            <CalculationDetails
              key={member.userId}
              name={`${member.name}님의`}
              details={member.details}
            />
          ))}
    </div>
  );
}
export function TeamReport({ context, manager = false }) {
  const { notify } = useInteractions();
  const navigate = useAppNavigate();
  const readiness = useResource(async () => {
    if (!manager) return null;
    const [rounds, dashboard] = await Promise.all([
      listEvaluationRounds(context.space.id),
      getManagerDashboard(context.space.id, context.team.id),
    ]);
    return { rounds, dashboard };
  }, [manager, context.space.id, context.team.id]);
  const resource = useResource(
    () => getTeamReport(context.team.id),
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
          ?.missingCount === 0 &&
        readiness.data.dashboard.missingPeerSubmissions
          .find((round) => round.type === type)
          ?.teams.find((team) => team.teamId === context.team.id)
          ?.requiredCount >= 2,
    );
  const knownBlock =
    readiness.loading ||
    Boolean(readiness.error) ||
    !closedRounds ||
    !teamSubmissionComplete ||
    context.team.approvedMemberCount < 2;
  const preparation = (
    <section className="panel">
      <ul
        className="readiness-list round-readiness"
        aria-label="회차별 리포트 준비 상태"
      >
        {['MID', 'FINAL'].map((type) => {
          const round = readiness.data?.rounds.find(
            (round) => round.type === type,
          );
          const submission = readiness.data?.dashboard.missingPeerSubmissions
            .find((entry) => entry.type === type)
            ?.teams.find((team) => team.teamId === context.team.id);
          return (
            <li key={type}>
              <strong>{roundLabels[type]}</strong>
              <span>
                {readiness.loading
                  ? '확인 중'
                  : round
                    ? roundStatusLabels[round.status]
                    : '회차 미설정'}
              </span>
              <span>
                {!round || round.status === 'DRAFT'
                  ? '참여자 고정 전'
                  : submission
                    ? `${submission.submittedCount}/${submission.requiredCount}명 제출 · 미제출 ${submission.missingCount}명`
                    : '제출 현황 확인 필요'}
              </span>
            </li>
          );
        })}
      </ul>
      {!knownBlock && (
        <p className="field-help">
          두 회차 마감과 해당 팀의 필수 제출 조건을 충족했습니다. 최종 계산 가능
          여부는 생성 시 확인합니다.
        </p>
      )}
      {context.team.approvedMemberCount < 2 && (
        <p className="notice">승인된 팀원 2명 이상이 필요합니다.</p>
      )}
      <button
        className="secondary-button"
        onClick={() => navigate(`${spacePath(context.space.id)}/rounds`)}
      >
        평가 회차 관리로
      </button>
      <div className="page-heading">
        <div>
          <h2>{context.team.name} 리포트</h2>
          <p>
            완료 작업과 우리 팀 중간·최종 평가 제출을 충족하면 현재 산식으로
            계산합니다.
          </p>
        </div>
        <button
          className={selected ? 'secondary-button' : 'primary-button'}
          disabled={
            busy ||
            resource.loading ||
            Boolean(resource.error) ||
            knownBlock ||
            Boolean(selected)
          }
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await generateTeamReport(context.team.id);
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
        확정된 입력으로 한 번 생성한 결과를 검토하고 공개합니다. 생성된 계산
        결과는 변경할 수 없습니다.
      </p>
    </section>
  );
  return (
    <div className="stack team-report">
      <div className="report-status-toolbar">
        {manager && (
          <ol className="process-steps" aria-label="리포트 진행 단계">
            <li className={!selected ? 'active' : ''}>1. 리포트 생성</li>
            <li className={selected?.status === 'UNPUBLISHED' ? 'active' : ''}>
              2. 검토
            </li>
            <li className={selected?.status === 'PUBLISHED' ? 'active' : ''}>
              3. 공개
            </li>
          </ol>
        )}
        <button
          className="secondary-button report-refresh"
          disabled={busy}
          onClick={() => {
            resource.reload();
            readiness.reload();
          }}
        >
          {manager ? '리포트·준비 상태 새로고침' : '리포트 새로고침'}
        </button>
      </div>
      <ErrorNotice error={error} />
      {manager && (
        <ErrorNotice error={readiness.error} onRetry={readiness.reload} />
      )}
      {manager && !selected && preparation}
      <ResourceState resource={resource}>
        {selected ? (
          <>
            <ReportDetail context={context} report={selected} />
            {manager && selected?.status === 'UNPUBLISHED' && (
              <section className="panel">
                <h2>검토 후 팀원에게 공개</h2>
                <p>
                  해당 팀의 중간·최종 평가 필수 제출 완료가 필요합니다. 다른
                  팀의 미제출은 공개를 막지 않습니다. 공개 결과는 불변입니다.
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
            {manager && (
              <details className="report-readiness-details">
                <summary>평가 제출·생성 조건 확인</summary>
                {preparation}
              </details>
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
                ? '두 평가의 마감·필수 제출과 완료 작업을 확인한 뒤 팀별 리포트를 생성해 주세요.'
                : '관리자가 최종 결과를 검토하고 공개하면 이곳에서 확인할 수 있습니다.'}
            </p>
          </EmptyState>
        )}
      </ResourceState>
      {manager && (
        <ManagerPeerResponses context={context} teamId={context.team.id} />
      )}
      {publishing && (
        <Modal
          title="기여도 리포트 공개"
          busy={busy}
          onClose={() => setPublishing(null)}
        >
          <p>
            {context.team.name}의 검토한 결과를 공개합니다. 팀원은 전체 최종
            비율과 자신의 계산 근거를 보게 됩니다. 공개 후에는 결과를 수정하거나
            비공개로 되돌릴 수 없습니다.
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
                  await publishReport(publishing.id);
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
    <section className="stack contribution-report-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">함께 만든 최종 결과</span>
          <h1>기여도 리포트</h1>
          <p>관리자가 공개한 팀 결과와 본인의 계산 근거를 확인하세요.</p>
        </div>
      </div>
      <TeamReport context={context} />
    </section>
  );
}
