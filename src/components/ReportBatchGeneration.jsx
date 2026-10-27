import { useEffect, useRef, useState } from 'react';
import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { listEvaluationRounds } from '../api/evaluations.js';
import { getManagerDashboard } from '../api/dashboard.js';
import { generateTeamReport } from '../api/reports.js';
import { getSpace } from '../api/spaces.js';
import { defaultReportWeights, reportWeightFields, sameReportWeights, validReportWeights } from '../lib/reportWeights.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { roundLabels, roundStatusLabels } from '../lib/evaluation.js';
import RefreshButton from './RefreshButton.jsx';
import { ErrorNotice, Field, ResourceState } from './ui.jsx';

function roundReadiness(type, rounds, dashboard) {
  const round = rounds.find((entry) => entry.type === type);
  const submission = dashboard.missingPeerSubmissions.find((entry) => entry.roundId === round?.id);
  const completedTeams = dashboard.teams.filter((team) => {
    const entry = submission?.teams.find((item) => item.teamId === team.teamId);
    return entry?.requiredCount >= 2 && entry.missingCount === 0 && entry.submittedCount === entry.requiredCount;
  }).length;
  return { type, round, completedTeams, complete: round?.status === 'CLOSED' && submission?.missingCount === 0 && completedTeams === dashboard.teams.length };
}

function generationState(data, teams) {
  if (!data) return null;
  const { rounds, dashboard } = data;
  const completeTeamList = dashboard.totalTeamCount === dashboard.teams.length &&
    teams.length === dashboard.teams.length && teams.every((team) => dashboard.teams.some((entry) => entry.teamId === team.id));
  const readiness = ['MID', 'FINAL'].map((type) => roundReadiness(type, rounds, dashboard));
  return {
    readiness,
    teams: dashboard.teams,
    pending: dashboard.teams.filter((team) => team.reportId == null),
    canGenerate: completeTeamList && dashboard.teams.length > 0 &&
      dashboard.teams.every((team) => team.approvedMemberCount >= 2) && readiness.every((entry) => entry.complete),
  };
}

export default function ReportBatchGeneration({ context, onGenerated }) {
  const guide = usePreviewGuide();
  const guidedManagement = guide?.guiding && guide.scenarioId === 'report-management' && context.manager;
  const { notify } = useInteractions();
  const loadReadiness = async () => {
    const [rounds, dashboard, space] = await Promise.all([
      listEvaluationRounds(context.space.id), getManagerDashboard(context.space.id), getSpace(context.space.id),
    ]);
    return { rounds, dashboard, space };
  };
  const resource = useResource(loadReadiness, [context.space.id, context.teams.map((team) => team.id).join(','), guide?.scope]);
  const state = generationState(resource.data, context.teams);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [failures, setFailures] = useState([]);
  const [progress, setProgress] = useState(null);
  const [draftWeights, setDraftWeights] = useState(defaultReportWeights);
  const [confirmedWeights, setConfirmedWeights] = useState(null);
  const lockedWeights = resource.data?.space.reportWeights ?? confirmedWeights;
  const weights = lockedWeights ?? draftWeights;
  const weightsValid = validReportWeights(weights);
  const totalWeight = reportWeightFields.reduce((sum, { key }) => sum + (Number.isFinite(weights[key]) ? weights[key] : 0), 0);
  const running = useRef(false);
  const allGenerated = state && state.teams.length > 0 && state.pending.length === 0;
  const reportBatch = guide?.setManagedReportBatch;
  useEffect(() => {
    if (!guidedManagement) return;
    reportBatch(!busy && !resource.loading && !resource.error && resource.data
      ? { ...resource.data, weights, canGenerate: state?.canGenerate } : null);
    return () => reportBatch(null);
  }, [guidedManagement, reportBatch, busy, resource.loading, resource.error, resource.data, weights, state?.canGenerate]);
  const generateAll = async () => {
    if (running.current || !weightsValid) return;
    const requestedWeights = { ...weights };
    running.current = true;
    setBusy(true);
    setError(null);
    setFailures([]);
    try {
      const latest = await loadReadiness();
      if (latest.space.reportWeights && !sameReportWeights(latest.space.reportWeights, requestedWeights)) {
        setConfirmedWeights(latest.space.reportWeights);
        setError(new Error('스페이스의 반영 비율이 이미 확정되었습니다. 표시된 비율을 확인한 뒤 다시 생성해 주세요.'));
        return;
      }
      const current = generationState(latest, context.teams);
      if (!current.canGenerate) {
        setError(new Error('전체 팀의 중간·최종 평가 마감과 필수 제출 완료 후 생성할 수 있습니다.'));
        return;
      }
      const failed = [];
      let generated = 0;
      setProgress({ finished: 0, total: current.pending.length });
      for (const [index, team] of current.pending.entries()) {
        try {
          const report = await generateTeamReport(team.teamId, requestedWeights);
          if (!sameReportWeights(report.weights, requestedWeights)) {
            const confirmed = validReportWeights(report.weights);
            if (confirmed) setConfirmedWeights(report.weights);
            throw Object.assign(new Error('생성 결과의 반영 비율 정보를 확인할 수 없습니다. 전체 현황을 새로 불러와 주세요.'), { code: confirmed ? 'REPORT_WEIGHTS_LOCKED' : 'REPORT_WEIGHTS_UNAVAILABLE' });
          }
          setConfirmedWeights(report.weights);
          generated += 1;
        } catch (error) {
          failed.push({ teamId: team.teamId, name: team.teamName, error });
          if (['REPORT_WEIGHTS_LOCKED', 'REPORT_WEIGHTS_UNAVAILABLE'].includes(error.code)) break;
        }
        setProgress({ finished: index + 1, total: current.pending.length });
      }
      setFailures(failed);
      if (generated > 0) notify(`${generated}개 팀의 리포트를 미공개 상태로 생성했습니다.`);
    } catch (error) {
      setError(error);
    } finally {
      resource.reload();
      onGenerated();
      setProgress(null);
      setBusy(false);
      running.current = false;
    }
  };
  const weightSettings = (
    <fieldset className="report-weight-settings" disabled={busy || resource.loading || Boolean(lockedWeights)}>
      <legend>리포트 반영 비율</legend>
      <div className="report-weight-fields">
        {reportWeightFields.map(({ key, label }) => <Field key={key} label={`${label} 반영 비율`}>
          <div className="report-weight-input">
            <input type="number" min="0" max="100" step="1" required value={weights[key] ?? ''}
              aria-describedby="report-weight-guidance" aria-invalid={!weightsValid || undefined}
              onChange={(event) => setDraftWeights((current) => ({ ...current, [key]: event.target.value === '' ? null : event.target.valueAsNumber }))} />
            <span aria-hidden="true">%</span>
          </div>
        </Field>)}
      </div>
      <p id="report-weight-guidance" className={weightsValid ? 'field-help' : 'notice'}>
        {lockedWeights ? '스페이스 공통 비율이 확정되어 변경할 수 없습니다.' : weightsValid ? '첫 리포트 생성 성공 시 모든 팀에 적용할 비율이 확정됩니다.' : '각 항목은 0~100의 정수이며, 합계가 100%여야 합니다.'}
        <span className="report-weight-total">합계 {totalWeight}%</span>
      </p>
    </fieldset>
  );
  return (
    <section className="report-batch-generation" aria-label="전체 팀 리포트 생성" aria-busy={busy}>
      <div className="section-heading">
        <div>
          <h2>{allGenerated ? '전체 리포트 생성 완료' : '전체 리포트 생성'}</h2>
          {state && <p>생성 {state.teams.length - state.pending.length} / {state.teams.length}팀</p>}
        </div>
        <div className="heading-actions">
          <RefreshButton label="전체 리포트 생성 조건 새로고침" disabled={busy || resource.loading} onClick={resource.reload} />
          {!allGenerated && <button type="button" className="primary-button" data-guide="generate-all-reports"
            disabled={busy || resource.loading || Boolean(resource.error) || !state?.canGenerate || !weightsValid
              || (guidedManagement && guide.stepId === 'management-report-weights')}
            onClick={generateAll}>
            {busy ? progress ? `생성 중 ${progress.finished}/${progress.total}팀` : '생성 조건 확인 중…' : '전체 리포트 생성'}
          </button>}
        </div>
      </div>
      <ErrorNotice error={error} />
      <ResourceState resource={resource} label="전체 리포트 생성 조건">
        {state && !allGenerated && weightSettings}
        {state && allGenerated && validReportWeights(lockedWeights) && <details className="report-weights-disclosure">
          <summary>적용된 반영 비율 <span>{reportWeightFields.map(({ key, label }) => `${label} ${weights[key]}%`).join(' · ')}</span></summary>
          {weightSettings}
        </details>}
        {state && allGenerated && !validReportWeights(lockedWeights) && <p className="field-help">확정된 반영 비율 정보를 다시 불러와 주세요.</p>}
        {state && !allGenerated && <>
          <ul className="readiness-list round-readiness" aria-label="회차별 리포트 준비 상태">
            {state.readiness.map(({ type, round, completedTeams }) => <li key={type}>
              <strong>{roundLabels[type]}</strong>
              <span>{round ? roundStatusLabels[round.status] : '회차 미설정'}</span>
              <span>{completedTeams}/{state.teams.length}팀 제출 완료</span>
            </li>)}
          </ul>
          <p className="field-help">모든 팀의 중간·최종 평가가 마감되고 필수 제출이 완료되면 미생성 리포트를 한 번에 생성합니다. 생성 후 팀별 결과를 확인하고 공개 여부를 결정할 수 있습니다.</p>
        </>}
        {guidedManagement && guide.stepId === 'management-report-weights' && <div className="heading-actions preview-guide-inline-action">
          <button className="secondary-button" data-guide="confirm-management-report-weights" disabled={!guide.reportManagementReady}
            onClick={() => guide.confirmReportManagementStep('management-report-weights')}>생성 조건 확인 완료</button>
        </div>}
      </ResourceState>
      {failures.length > 0 && <div className="report-generation-failures">
        <p>일부 리포트를 생성하지 못했습니다. 다시 생성하면 이미 생성된 팀은 건너뜁니다.</p>
        {failures.map((failure) => <div key={failure.teamId}><strong>{failure.name}</strong><ErrorNotice error={failure.error} /></div>)}
      </div>}
    </section>
  );
}
