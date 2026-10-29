import { apiTimeToEpoch, koreanDateTime } from '../lib/koreanTime.js';
import RefreshButton from './RefreshButton.jsx';
import '../space-operation.css';
import { useEffect, useId, useRef, useState } from 'react';
import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useSearchParams } from 'react-router';
import SectionTabs from './SectionTabs.jsx';
import ManagerPeerResponses from './ManagerPeerResponses.jsx';
import DateTimeInput from './DateTimeInput.jsx';
import { ProgressBar } from './PlanningUi.jsx';
import '../round-management.css';
import {
  listEvaluationRounds,
  createEvaluationRound,
  updateEvaluationRound,
} from '../api/evaluations.js';
import { getManagerDashboard } from '../api/dashboard.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { formatDate, fromDateInput, toDateInput } from '../lib/domain.js';
import { roundLabels } from '../lib/evaluation.js';
import {
  ErrorNotice,
  Field,
  FormActions,
  Modal,
  ResourceState,
} from './ui.jsx';

const startBlockMessages = {
  SCHEDULE_EXPIRED: '시작하지 못한 채 평가 기간이 지났습니다. 새 일정을 설정해 주세요.',
  TEAM_BUILDING_NOT_CONFIGURED: '스페이스 관리에서 팀 빌딩 기간을 설정해 주세요.',
  TEAM_BUILDING_OPEN: '팀 빌딩 기간이 아직 끝나지 않았습니다.',
  ROUND_PARTICIPANTS_EMPTY: '평가에 참여할 팀이 없습니다.',
  TEAM_TOO_SMALL: '모든 팀에 승인된 팀원 2명 이상이 필요합니다.',
  MID_ROUND_NOT_CLOSED: '중간 평가의 마감과 참여자 확정이 완료되지 않았습니다.',
};

function RoundPeriodDate({ value }) {
  const formatted = formatDate(value);
  const parts = formatted.match(/^(.*) (\d{2}:\d{2})$/);
  return <time dateTime={value}>{parts ? <><span>{parts[1]}</span><span className="round-period-time">{parts[2]}</span></> : formatted}</time>;
}

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
  const rounds = resource.data || [];
  const closingOnly = editing?.round?.status === 'OPEN';
  useEffect(() => {
    if (activeTab !== 'operations' || editing || busy || !rounds.some((round) => ['DRAFT', 'OPEN'].includes(round.status))) return;
    const timer = setInterval(() => {
      if (!document.hidden) { resource.reload(); submissions.reload(); }
    }, 15000);
    return () => clearInterval(timer);
  }, [activeTab, editing, busy, resource.data, resource.reload, submissions.reload]);
  const previousRoundStatuses = useRef(null);
  useEffect(() => { previousRoundStatuses.current = null; }, [context.space.id, guide?.scope]);
  useEffect(() => {
    if (!resource.data) return;
    const lifecycleChanged = previousRoundStatuses.current != null && resource.data.some((round) =>
      ['OPEN', 'CLOSED'].includes(round.status) && previousRoundStatuses.current[round.id] !== round.status);
    previousRoundStatuses.current = Object.fromEntries(resource.data.map((round) => [round.id, round.status]));
    if (lifecycleChanged) onChanged?.();
  }, [resource.data, onChanged]);
  const reportEvaluationState = guide?.setEvaluationState;
  const ready = !busy && !resource.loading && !resource.error && !submissions.loading && !submissions.error;
  const midRound = rounds.find((round) => round.type === 'MID' && ['OPEN', 'CLOSED'].includes(round.status));
  const visibleSubmissionRoundId = ready && midRound
    && submissions.data?.missingPeerSubmissions.some((item) => item.roundId === midRound.id && item.teams.length > 0)
    ? midRound.id : null;
  useEffect(() => {
    if (!guidedEvaluation) return;
    reportEvaluationState(ready && activeTab === 'operations' && resource.data && submissions.data
      ? { space: context.space, rounds: resource.data, dashboard: submissions.data, viewedRoundId: visibleSubmissionRoundId } : null);
    return () => reportEvaluationState(null);
  }, [guidedEvaluation, reportEvaluationState, ready, activeTab, resource.data, submissions.data, context.space, visibleSubmissionRoundId]);
  useEffect(() => {
    setEditing(null);
    setError(null);
  }, [guide?.scope]);
  const openForm = (kind, round) => {
    setError(null);
    setEditing({ kind, round });
    const earliestStart = Math.max(Date.now(), apiTimeToEpoch(context.space.teamBuildingClosesAt) || 0,
      round.type === 'FINAL' ? apiTimeToEpoch(rounds.find((item) => item.type === 'MID')?.closesAt) || 0 : 0);
    const nextForm = guidedEvaluation && guide.stepId === 'evaluation-schedule' && kind === 'create' && round.type === 'MID'
      ? { ...guide.evaluationSchedule } : {
        type: round.type,
        opensAt: toDateInput(round.opensAt) || koreanDateTime(earliestStart).slice(0, 16),
        closesAt: toDateInput(round.closesAt) || koreanDateTime(earliestStart + 7 * 86400000).slice(0, 16),
      };
    setForm(nextForm);
    setInitialForm(nextForm);
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
      <SectionTabs id={tabsId} label="평가 관리 항목" tabs={[['operations', '평가 일정·진행 현황'], ['peer-responses', '동료 평가 결과']]}
        activeTab={activeTab} onSelect={selectTab} />
      <div role="tabpanel" id={`${tabsId}-operations-panel`} aria-labelledby={`${tabsId}-operations-tab`} hidden={activeTab !== 'operations'}>
      {activeTab === 'operations' && <div className="stack">
      <ErrorNotice error={submissions.error} onRetry={reload} />
      <ErrorNotice error={error} />
      <ResourceState resource={resource}>
          <div className="round-operation-sections" data-guide="evaluation-rounds" role="region" aria-label="평가 회차 일정과 제출 현황">
            {['MID', 'FINAL'].map((type) => {
              const round = rounds.find((item) => item.type === type);
              const needsMidSchedule = type === 'FINAL' && !rounds.some((item) => item.type === 'MID');
              const status = round?.status || 'UNCONFIGURED';
              const teamSubmissions = submissions.data?.missingPeerSubmissions.find((item) => item.roundId === round?.id)?.teams;
              const startBlockReasons = status === 'DRAFT' && Array.isArray(round.startBlockReasons) ? round.startBlockReasons : [];
              const hasSubmissions = !submissions.error && teamSubmissions?.length > 0;
              const stateLabel = { UNCONFIGURED: '미설정', DRAFT: '시작 예정', OPEN: '평가 진행 중', CLOSED: '평가 종료' }[status];
              return <section className={`round-operation-section is-${status.toLowerCase()}`} data-guide-round={type} key={type} aria-label={`${roundLabels[type]} 운영`}>
                <header className="round-section-heading">
                  <div><h2>{roundLabels[type]}</h2><span className={`status-badge round-lifecycle-${status.toLowerCase()}`}>{stateLabel}</span></div>
                  <div className="round-management-actions">
                    {!round && <button className="primary-button" data-guide={type === 'MID' ? 'schedule-mid-evaluation' : undefined} disabled={busy || needsMidSchedule} aria-label={`${roundLabels[type]} 일정 설정`} onClick={() => openForm('create', { type })}>일정 설정</button>}
                    {startBlockReasons.length > 0 && <button className="secondary-button" disabled={busy} aria-label={`${roundLabels[type]} 일정 수정`} onClick={() => openForm('edit', round)}>일정 수정</button>}
                    {status === 'OPEN' && <button className="ghost-button" disabled={busy} aria-label={`${roundLabels[type]} 마감 시각 수정`} onClick={() => openForm('edit', round)}>마감 변경</button>}
                  </div>
                  {round && <dl className="round-period" aria-label="평가 기간">
                    <div><dt className="sr-only">시작</dt><dd><RoundPeriodDate value={round.opensAt} /></dd></div>
                    <div><dt className="sr-only">마감</dt><dd><RoundPeriodDate value={round.closesAt} /></dd></div>
                  </dl>}
                </header>
                {(!round || status === 'CLOSED' || (status === 'OPEN' && !hasSubmissions)) && <div className="round-section-content">
                  <div className="round-section-schedule">
                    {!round && <p className="round-empty-schedule">평가 일정을 설정해 주세요.</p>}
                    {needsMidSchedule && <p className="round-opening-block">중간 평가 일정을 먼저 설정해 주세요.</p>}
                    {status === 'CLOSED' && <p className="round-table-note">동료 평가 결과 탭에서 제출된 응답을 확인할 수 있습니다.</p>}
                  </div>
                  {['OPEN', 'CLOSED'].includes(status) && !hasSubmissions && <p className="round-table-note">{submissions.loading ? '제출 현황을 불러오는 중…' : submissions.error || !teamSubmissions ? '제출 현황을 다시 불러와 주세요.' : '참여 팀이 없습니다.'}</p>}
                </div>}
                {startBlockReasons.length > 0 && <div className="round-start-block" role="status"><strong>평가를 시작하지 못했습니다.</strong><ul>{startBlockReasons.map((reason) => <li key={reason}>{startBlockMessages[reason] || '시작 조건을 확인하지 못했습니다. 현황을 새로고침해 주세요.'}</li>)}</ul></div>}
                {hasSubmissions && ['OPEN', 'CLOSED'].includes(status) && <div className="round-submission-detail" id={`round-${round.id}-submissions`} role="region" aria-label={`${roundLabels[type]} 팀별 제출 현황`}>
                  <ul className="round-team-submissions">{(teamSubmissions || []).map((team) => <li key={team.teamId}>
                    <strong>{context.teams.find((item) => item.id === team.teamId)?.name || `팀 #${team.teamId}`}</strong>
                    <span>{team.requiredCount}명 중 {team.submittedCount}명 제출</span>
                    <ProgressBar value={team.requiredCount > 0 ? team.submittedCount / team.requiredCount * 100 : null} label={`${roundLabels[type]} ${context.teams.find((item) => item.id === team.teamId)?.name || `팀 #${team.teamId}`} 제출률`} />
                    <span className={team.missingCount > 0 ? 'round-missing-count' : 'round-table-note'}>{team.missingCount > 0 ? `미제출 ${team.missingCount}명` : '전원 제출'}</span>
                  </li>)}</ul>
                  {guidedEvaluation && guide.stepId === 'evaluation-result' && type === 'MID' && <div className="heading-actions preview-guide-inline-action">
                    <button className="secondary-button" data-guide="confirm-evaluation-result" disabled={!ready || !guide.evaluationReady} onClick={() => guide.confirmEvaluationStep('evaluation-result')}>시작 결과 확인 완료</button>
                  </div>}
                </div>}
              </section>;
            })}
          </div>
          {guidedEvaluation && guide.stepId === 'evaluation-overview' && <div className="heading-actions preview-guide-inline-action">
            <button className="secondary-button" data-guide="confirm-evaluation-overview" disabled={!ready || !guide.evaluationReady}
              onClick={() => guide.confirmEvaluationStep('evaluation-overview')}>평가 회차 확인 완료</button>
          </div>}
      </ResourceState>
      <details className="round-operation-guide">
        <summary>평가 운영 기준</summary>
        <p>저장한 시작 시각에 평가가 자동으로 열립니다. 중간 평가 시작 시 팀 구성과 평가 참여자가 고정됩니다. 모든 팀에 승인된 팀원 2명 이상이 필요하며, 팀 빌딩 기간 종료 후 설정한 평가 기간 내에 시작할 수 있습니다.</p>
        <p>중간 평가 마감 후 예약된 시각에 최종 평가가 자동으로 시작됩니다. 최종 평가 마감 시각은 작업 집계 기준이며, 이 시각부터 작업 변경이 제한됩니다.</p>
        <p>마감된 회차는 일정 수정·추가 제출·재개방을 제공하지 않습니다. 최종 결과는 팀별 리포트에서 검토하고 공개합니다.</p>
      </details>
      </div>}
      </div>
      <div role="tabpanel" id={`${tabsId}-peer-responses-panel`} aria-labelledby={`${tabsId}-peer-responses-tab`} hidden={activeTab !== 'peer-responses'}>
        {activeTab === 'peer-responses' && <ManagerPeerResponses context={context} teamId={resultTeamId} expanded />}
      </div>
      {editing && (
        <Modal
          title={
            `${roundLabels[form.type]} ${editing.kind === 'create' ? '일정 설정' : closingOnly ? '마감 변경' : '일정 수정'}`
          }
          busy={busy}
          onClose={() => setEditing(null)}
          dirty={JSON.stringify(form) !== JSON.stringify(initialForm)}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              if (apiTimeToEpoch(form.closesAt) <= apiTimeToEpoch(form.opensAt)) {
                setError(new Error('마감 시각은 시작 시각보다 늦어야 합니다.')); return;
              }
              if (apiTimeToEpoch(form.closesAt) <= Date.now()) {
                setError(new Error('마감 시각은 현재 시각보다 늦어야 합니다.')); return;
              }
              setBusy(true);
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
                notify(closingOnly ? '평가 마감 시각을 변경했습니다.' : '자동 시작 일정을 저장했습니다.');
                reload();
              } catch (error) {
                setError(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            {closingOnly ? <p className="field-help">시작 {formatDate(editing.round.opensAt)} · 시작 시각은 변경할 수 없습니다.</p> : <>
              <p className="field-help">일정을 저장하면 시작 시각에 자동으로 평가가 열립니다. 중간 평가가 시작되면 팀 구성과 평가 참여자가 고정됩니다.</p>
              <Field label="평가 시작 시각">
                <DateTimeInput name="opensAt" required disabled={busy} value={form.opensAt}
                  onChange={(event) => setForm({ ...form, opensAt: event.target.value })} />
              </Field>
            </>}
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
