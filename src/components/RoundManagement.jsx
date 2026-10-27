import { apiTimeToEpoch } from '../lib/koreanTime.js';
import RefreshButton from './RefreshButton.jsx';
import '../space-operation.css';
import { useEffect, useId, useState } from 'react';
import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useSearchParams } from 'react-router';
import SectionTabs from './SectionTabs.jsx';
import ManagerPeerResponses from './ManagerPeerResponses.jsx';
import DateTimeInput from './DateTimeInput.jsx';
import { ProgressBar } from './PlanningUi.jsx';
import '../round-management.css';
import { currentDateTime } from '../lib/dateTime.js';
import {
  listEvaluationRounds,
  createEvaluationRound,
  updateEvaluationRound,
  openEvaluationRound,
} from '../api/evaluations.js';
import { getManagerDashboard } from '../api/dashboard.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { formatDate, fromDateInput, toDateInput } from '../lib/domain.js';
import { roundLabels, roundStatusLabels } from '../lib/evaluation.js';
import {
  ErrorNotice,
  Field,
  FormActions,
  Modal,
  ResourceState,
} from './ui.jsx';

export default function RoundManagement({ context, onChanged }) {
  const guide = usePreviewGuide();
  const guidedEvaluation = guide?.guiding && guide.scenarioId === 'evaluation-management' && context.manager;
  const { notify } = useInteractions();
  const [params, setParams] = useSearchParams();
  const tabsId = useId();
  const activeTab = params.get('tab') === 'peer-responses' ? 'peer-responses' : 'operations';
  const resultTeamId = context.teams.find((team) => String(team.id) === params.get('teamId'))?.id;
  const selectTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === 'operations') next.delete('tab'); else next.set('tab', key);
    setParams(next);
  };
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision((value) => value + 1);
  const resource = useResource(
    () => listEvaluationRounds(context.space.id),
    [context.space.id, revision, guide?.scope],
  );
  const submissions = useResource(
    () => getManagerDashboard(context.space.id),
    [context.space.id, revision, guide?.scope],
  );
  const [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const [form, setForm] = useState({ type: 'MID', opensAt: '', closesAt: '' });
  const [initialForm, setInitialForm] = useState(null);
  const [viewingSubmissions, setViewingSubmissions] = useState(null);
  const rounds = resource.data || [];
  const reportEvaluationState = guide?.setEvaluationState;
  const ready = !busy && !resource.loading && !resource.error && !submissions.loading && !submissions.error;
  useEffect(() => {
    if (!guidedEvaluation) return;
    reportEvaluationState(ready && activeTab === 'operations' && resource.data && submissions.data
      ? { space: context.space, rounds: resource.data, dashboard: submissions.data, viewedRoundId: viewingSubmissions?.id } : null);
    return () => reportEvaluationState(null);
  }, [guidedEvaluation, reportEvaluationState, ready, activeTab, resource.data, submissions.data, context.space, viewingSubmissions?.id]);
  useEffect(() => {
    setEditing(null);
    setViewingSubmissions(null);
    setError(null);
  }, [guide?.scope]);
  const openForm = (kind, round) => {
    setError(null);
    setEditing({ kind, round });
    const nextForm = guidedEvaluation && guide.stepId === 'evaluation-schedule' && kind === 'create' && round.type === 'MID'
      ? { ...guide.evaluationSchedule } : {
      type: round.type,
      opensAt: toDateInput(round?.opensAt) || currentDateTime(),
      closesAt:
        kind === 'edit'
          ? toDateInput(round?.closesAt) || currentDateTime()
          : currentDateTime(),
    };
    setForm(nextForm);
    setInitialForm(nextForm);
  };
  const openRound = async (round) => {
    setBusy(true);
    setError(null);
    try {
      await openEvaluationRound(round.id);
      onChanged?.();
      reload();
      notify(`${roundLabels[round.type]}를 시작했습니다.`);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  };
  const blockReason = (round) => {
    if (round.status !== 'DRAFT') return null;
    if (submissions.error) return '제출 현황을 다시 불러온 뒤 진행해 주세요.';
    if (submissions.loading || !submissions.data)
      return '참여 팀과 제출 조건을 확인하고 있습니다.';
    if (round.status === 'DRAFT') {
      if (!submissions.data.teams.length)
        return '평가에 참여할 팀이 필요합니다.';
      if (submissions.data.teams.some((team) => team.approvedMemberCount < 2))
        return '모든 팀에 승인된 팀원 2명 이상이 필요합니다.';
      if (new Date(apiTimeToEpoch(context.space.teamBuildingClosesAt)) > new Date())
        return '팀 빌딩 기간이 종료된 뒤 시작할 수 있습니다.';
      if (
        round.type === 'FINAL' &&
        rounds.find((entry) => entry.type === 'MID')?.status !== 'CLOSED'
      )
        return '중간 평가를 먼저 마감해 주세요.';
      if (
        new Date(apiTimeToEpoch(round.opensAt)) > new Date() ||
        new Date(apiTimeToEpoch(round.closesAt)) <= new Date()
      )
        return '설정한 시작 시각부터 마감 시각 전까지만 시작할 수 있습니다.';
    }
    return null;
  };
  return (
    <section className="stack space-operation-page round-management-page">
      <div className="page-heading page-heading--compact">
        <div>
          <h1>동료 평가 관리</h1>
        </div>
        {activeTab === 'operations' && <div className="heading-actions">
          <RefreshButton
            label="회차·제출 현황 새로고침"
            disabled={busy || resource.loading || submissions.loading}
            onClick={reload}
          />
        </div>}
      </div>
      <SectionTabs id={tabsId} label="평가 관리 항목" tabs={[['operations', '회차 운영'], ['peer-responses', '동료 평가 결과']]}
        activeTab={activeTab} onSelect={selectTab} />
      <div role="tabpanel" id={`${tabsId}-operations-panel`} aria-labelledby={`${tabsId}-operations-tab`} hidden={activeTab !== 'operations'}>
      {activeTab === 'operations' && <div className="stack">
      <div className="round-management-context">
        <span className="status-badge round-membership-status">
          {context.space.membershipLockedAt ? '팀 구성 고정' : '팀 구성 확정 전'}
        </span>
      </div>
      <ErrorNotice error={submissions.error} onRetry={reload} />
      <ErrorNotice error={error} />
      <ResourceState resource={resource}>
          <div className="table-scroll" data-guide="evaluation-rounds" role="region" aria-label="평가 회차 일정과 제출 현황" tabIndex={0}>
            <table className="data-table round-management-table">
              <caption className="sr-only">중간·최종 평가 회차 운영 현황</caption>
              <thead><tr>
                <th scope="col">평가 회차</th><th scope="col">진행 상태</th>
                <th scope="col">평가 기간</th><th scope="col">제출 현황</th><th scope="col">관리</th>
              </tr></thead>
              <tbody>
                {['MID', 'FINAL'].map((type) => {
                  const round = rounds.find((entry) => entry.type === type);
                  const needsMidSchedule = type === 'FINAL' && !rounds.some((entry) => entry.type === 'MID');
                  if (!round) return (
                    <tr key={type} data-guide-round={type}>
                      <th scope="row"><span className="round-name">{roundLabels[type]}</span></th>
                      <td><span className="status-badge round-lifecycle-status round-lifecycle-unconfigured">미설정</span></td>
                      <td><span className="round-table-note">일정을 설정해 주세요.</span></td>
                      <td><span className="round-table-note">평가 시작 후 집계</span></td>
                      <td><div className="round-management-actions">
                        <button type="button" className="secondary-button" data-guide={type === 'MID' ? 'schedule-mid-evaluation' : undefined} disabled={busy || resource.loading || needsMidSchedule} aria-label={`${roundLabels[type]} 일정 설정`} onClick={() => openForm('create', { type })}>일정 설정</button>
                      </div>
                        {needsMidSchedule && <p className="round-opening-block">중간 평가 일정을 먼저 설정해 주세요.</p>}
                      </td>
                    </tr>
                  );
                  const teamSubmissions = submissions.data?.missingPeerSubmissions.find((item) => item.roundId === round.id)?.teams;
                  const submittedCount = teamSubmissions?.reduce((sum, team) => sum + team.submittedCount, 0);
                  const requiredCount = teamSubmissions?.reduce((sum, team) => sum + team.requiredCount, 0);
                  const missingCount = teamSubmissions?.reduce((sum, team) => sum + team.missingCount, 0);
                  const openingBlockReason = blockReason(round);
                  return (
                    <tr key={round.id} data-guide-round={type}>
                      <th scope="row"><span className="round-name">{roundLabels[round.type]}</span></th>
                      <td>
                        <span className={`status-badge round-lifecycle-status round-lifecycle-${round.status.toLowerCase()}`}>{roundStatusLabels[round.status]}</span>
                        {round.status !== 'DRAFT' && <span className="round-table-note">참여자 {round.participantCount}명</span>}
                      </td>
                      <td><dl className="round-period">
                        <div><dt>시작</dt><dd><time dateTime={round.opensAt}>{formatDate(round.opensAt)}</time></dd></div>
                        <div><dt>마감</dt><dd><time dateTime={round.closesAt}>{formatDate(round.closesAt)}</time></dd></div>
                      </dl></td>
                      <td>
                        {round.status === 'DRAFT' ? <span className="round-table-note">평가 시작 후 집계</span>
                          : submissions.loading ? <span className="round-table-note">불러오는 중…</span>
                          : submissions.error || !teamSubmissions ? <span className="round-table-note">현황 확인 필요</span>
                          : !teamSubmissions.length ? <span className="round-table-note">참여 팀 없음</span>
                          : <div className="round-submission-overview">
                            <strong>{submittedCount} / {requiredCount}명</strong>
                            <span className={missingCount > 0 ? 'round-missing-count' : 'round-table-note'}>{requiredCount === 0 ? '평가 대상 없음' : missingCount > 0 ? `미제출 ${missingCount}명` : '전원 제출'}</span>
                            <button type="button" className="round-detail-button" data-guide={type === 'MID' ? 'view-mid-submissions' : undefined} aria-label={`${roundLabels[round.type]} 팀별 제출 현황 보기`} aria-haspopup="dialog" onClick={() => setViewingSubmissions(round)}>팀별 현황 보기</button>
                          </div>}
                      </td>
                      <td>
                        <div className="round-management-actions">
                          {round.status === 'DRAFT' && <>
                            <button className="secondary-button" disabled={busy} aria-label={`${roundLabels[round.type]} 일정 수정`} onClick={() => openForm('edit', round)}>일정 수정</button>
                            <button className="primary-button" data-guide={type === 'MID' ? 'start-mid-evaluation' : undefined} disabled={busy || Boolean(openingBlockReason)} aria-label={`${roundLabels[round.type]} 시작`} onClick={() => openRound(round)}>평가 시작</button>
                          </>}
                          {round.status === 'OPEN' && <button className="secondary-button" disabled={busy} aria-label={`${roundLabels[round.type]} 마감 시각 수정`} onClick={() => openForm('edit', round)}>마감 시각 수정</button>}
                          {round.status === 'CLOSED' && <span className="round-table-note">종료된 평가</span>}
                        </div>
                        {openingBlockReason && <p className="round-opening-block">{openingBlockReason}</p>}
                        {round.status === 'OPEN' && <span className="round-table-note">마감 시각에 자동 종료</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {guidedEvaluation && guide.stepId === 'evaluation-overview' && <div className="heading-actions preview-guide-inline-action">
            <button className="secondary-button" data-guide="confirm-evaluation-overview" disabled={!ready || !guide.evaluationReady}
              onClick={() => guide.confirmEvaluationStep('evaluation-overview')}>평가 회차 확인 완료</button>
          </div>}
      </ResourceState>
      <details className="round-operation-guide">
        <summary>평가 운영 기준</summary>
        <p>중간 평가를 시작하면 팀 구성과 평가 참여자가 고정됩니다. 모든 팀에 승인된 팀원 2명 이상이 필요하며, 팀 빌딩 기간 종료 후 설정한 평가 기간 내에 시작할 수 있습니다.</p>
        <p>중간 평가 마감 후 최종 평가를 시작할 수 있습니다. 최종 평가 마감 시각은 작업 집계 기준이며, 이 시각부터 작업 변경이 제한됩니다.</p>
        <p>마감된 회차는 일정 수정·추가 제출·재개방을 제공하지 않습니다. 최종 결과는 팀별 리포트에서 검토하고 공개합니다.</p>
      </details>
      </div>}
      </div>
      <div role="tabpanel" id={`${tabsId}-peer-responses-panel`} aria-labelledby={`${tabsId}-peer-responses-tab`} hidden={activeTab !== 'peer-responses'}>
        {activeTab === 'peer-responses' && <ManagerPeerResponses context={context} teamId={resultTeamId} expanded />}
      </div>
      {viewingSubmissions && (
        <Modal title={`${roundLabels[viewingSubmissions.type]} 팀별 제출 현황`} wide className="round-submission-modal" onClose={() => setViewingSubmissions(null)}>
          <p className="field-help">최종 제출을 완료한 평가자 수를 기준으로 표시합니다.</p>
          <div className="table-scroll">
            <table className="data-table round-submission-table">
              <caption className="sr-only">{roundLabels[viewingSubmissions.type]} 팀별 제출 현황</caption>
              <thead><tr><th scope="col">팀</th><th scope="col">제출</th><th scope="col">제출률</th><th scope="col">미제출</th></tr></thead>
              <tbody>{(submissions.data?.missingPeerSubmissions.find((item) => item.roundId === viewingSubmissions.id)?.teams || []).map((team) => {
                const teamName = context.teams.find((entry) => entry.id === team.teamId)?.name || `팀 #${team.teamId}`;
                return <tr key={team.teamId}>
                  <th scope="row">{teamName}</th><td>{team.submittedCount} / {team.requiredCount}명</td>
                  <td>{team.requiredCount > 0 ? <ProgressBar value={(team.submittedCount / team.requiredCount) * 100} label={`${roundLabels[viewingSubmissions.type]} ${teamName} 제출률`} /> : <span className="round-table-note">평가 대상 없음</span>}</td>
                  <td className={team.missingCount > 0 ? 'round-missing-count' : ''}>{team.missingCount}명</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          {guidedEvaluation && guide.stepId === 'evaluation-result' && viewingSubmissions.type === 'MID' && <div className="modal-actions">
            <button className="primary-button" data-guide="confirm-evaluation-result" disabled={!ready || !guide.evaluationReady}
              onClick={() => { if (guide.confirmEvaluationStep('evaluation-result')) setViewingSubmissions(null); }}>시작 결과 확인 완료</button>
          </div>}
        </Modal>
      )}

      {editing && (
        <Modal
          title={
            editing.kind === 'create' ? `${roundLabels[form.type]} 일정 설정` : '평가 일정 수정'
          }
          busy={busy}
          onClose={() => setEditing(null)}
          dirty={JSON.stringify(form) !== JSON.stringify(initialForm)}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const body = {
                  type: form.type,
                  opensAt: fromDateInput(form.opensAt),
                  closesAt: fromDateInput(form.closesAt),
                };
                if (editing.kind === 'create')
                  await createEvaluationRound(context.space.id, body);
                else
                  await updateEvaluationRound(editing.round.id, {
                    ...(editing.round.status === 'DRAFT'
                      ? { opensAt: body.opensAt }
                      : {}),
                    closesAt: body.closesAt,
                    expectedVersion: editing.round.version,
                  });
                setEditing(null);
                notify('평가 일정을 저장했습니다.');
                reload();
              } catch (error) {
                setError(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="평가 종류">
              <select
                disabled
                value={form.type}
              >
                {['MID', 'FINAL']
                  .filter(
                    (type) =>
                      editing.kind !== 'create' ||
                      !rounds.some((round) => round.type === type),
                  )
                  .map((type) => (
                    <option key={type} value={type}>
                      {roundLabels[type]}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="평가 시작 시각">
              <DateTimeInput
                name="opensAt"
                required
                disabled={busy || editing.round?.status === 'OPEN'}
                value={form.opensAt}
                onChange={(event) =>
                  setForm({ ...form, opensAt: event.target.value })
                }
              />
            </Field>
            <Field label="평가 마감 시각">
              <DateTimeInput
                name="closesAt"
                required
                disabled={busy}
                value={form.closesAt}
                onChange={(event) =>
                  setForm({ ...form, closesAt: event.target.value })
                }
              />
            </Field>
            <ErrorNotice error={error} />
            <FormActions
              busy={busy}
              onCancel={() => setEditing(null)}
              label="저장"
            />
          </form>
        </Modal>
      )}
    </section>
  );
}
