import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Clock3 } from 'lucide-react';
import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { getSpaceReports, generateSpaceReports, publishSpaceReports, reportBlockMessage } from '../api/spaceReports.js';
import { defaultReportWeights, reportWeightFields, sameReportWeights, validReportWeights } from '../lib/reportWeights.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { ErrorNotice, Field, Modal, ResourceState } from './ui.jsx';

export default function ReportBatchGeneration({ context, onGenerated, onReadinessLoaded, refreshRevision = 0, onBusyChange }) {
  const guide = usePreviewGuide();
  const guidedManagement = guide?.guiding && guide.scenarioId === 'report-management' && context.manager;
  const { notify } = useInteractions();
  const resource = useResource(() => getSpaceReports(context.space.id), [context.space.id, guide?.scope, refreshRevision]);
  const data = !resource.loading && !resource.error ? resource.data : null;
  const state = data && {
    teams: data.teams, pending: data.teams.filter((team) => team.reportId == null), canGenerate: data.canGenerate,
  };
  useEffect(() => { onReadinessLoaded?.(data?.teams ?? null); }, [data, onReadinessLoaded]);
  const [busy, setBusy] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  useEffect(() => {
    if (guidedManagement && guide.stepId !== 'management-report-weights') setWeightsOpen(false);
  }, [guidedManagement, guide?.stepId]);
  useEffect(() => { onBusyChange?.(busy || resource.loading); }, [busy, resource.loading, onBusyChange]);
  const [error, setError] = useState(null);
  const [confirmingPublication, setConfirmingPublication] = useState(null);
  const [draftWeights, setDraftWeights] = useState(defaultReportWeights);
  const [confirmedWeights, setConfirmedWeights] = useState(null);
  const lockedWeights = (resource.data?.weightsConfirmed ? resource.data.weights : null) ?? confirmedWeights;
  const weights = lockedWeights ?? draftWeights;
  const weightsValid = validReportWeights(weights);
  const totalWeight = reportWeightFields.reduce((sum, { key }) => sum + (Number.isFinite(weights[key]) ? weights[key] : 0), 0);
  const running = useRef(false);
  const allGenerated = state && state.teams.length > 0 && state.pending.length === 0;
  const reportBatch = guide?.setManagedReportBatch;
  useEffect(() => {
    if (!guidedManagement) return;
    reportBatch(!busy && !resource.loading && !resource.error && resource.data
      ? { ...resource.data, weights } : null);
    return () => reportBatch(null);
  }, [guidedManagement, reportBatch, busy, resource.loading, resource.error, resource.data, weights, state?.canGenerate]);
  const canPublish = Boolean(data?.canPublish && data.totalTeamCount > 0
    && data.generatedTeamCount === data.totalTeamCount && data.publishedTeamCount < data.totalTeamCount);
  const allPublished = Boolean(data?.totalTeamCount > 0 && data.publishedTeamCount === data.totalTeamCount);
  const execute = async (action) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch (requestError) { setError(requestError); }
    finally { resource.reload(); onGenerated(); setBusy(false); running.current = false; }
  };
  const generateAll = () => {
    if (!weightsValid || !state?.canGenerate) return;
    const requestedWeights = { ...weights };
    execute(async () => {
      const latest = await getSpaceReports(context.space.id);
      if (latest.weightsConfirmed && !sameReportWeights(latest.weights, requestedWeights)) {
        setConfirmedWeights(latest.weights);
        throw new Error('스페이스의 반영 비율이 이미 확정되었습니다. 표시된 비율을 확인한 뒤 다시 생성해 주세요.');
      }
      if (!latest.canGenerate) throw new Error(latest.generationBlockReasons.map(reportBlockMessage).join(' · ') || '현재 리포트를 생성할 수 없습니다. 현황을 확인해 주세요.');
      await generateSpaceReports(context.space.id, requestedWeights);
      notify('전체 리포트 생성 요청을 처리했습니다. 생성 현황을 확인해 주세요.');
    });
  };
  const openPublication = () => execute(async () => {
    const latest = await getSpaceReports(context.space.id);
    if (!latest.canPublish || latest.totalTeamCount === 0 || latest.generatedTeamCount !== latest.totalTeamCount)
      throw new Error(latest.publicationBlockReasons.map(reportBlockMessage).join(' · ') || '현재 전체 리포트를 공개할 수 없습니다. 현황을 확인해 주세요.');
    setConfirmingPublication(latest);
  });
  const publishAll = () => execute(async () => {
    const latest = await getSpaceReports(context.space.id);
    const targets = (status) => status.teams.map((team) => `${team.teamId}:${team.reportId}:${team.reportStatus}`).sort().join('|');
    if (!latest.canPublish || targets(latest) !== targets(confirmingPublication)) {
      setConfirmingPublication(null);
      throw new Error('공개 대상 또는 상태가 변경되었습니다. 최신 현황에서 다시 확인해 주세요.');
    }
    await publishSpaceReports(context.space.id);
    setConfirmingPublication(null);
    notify('전체 팀의 리포트를 공개했습니다.');
  });
  const exampleScores = { taskPercent: 100, midPercent: 80, finalPercent: 90 };
  const exampleParts = reportWeightFields.map(({ key }) => weightsValid ? exampleScores[key] * weights[key] / 100 : null);
  const exampleTotal = weightsValid ? exampleParts.reduce((sum, value) => sum + value, 0) : null;
  const weightDescriptions = {
    taskPercent: '팀 평균 완료 작업량을 충족하면 작업 점수는 100점입니다.',
    midPercent: '중간 평가에서 받은 네 항목의 절대 평가 평균을 반영합니다.',
    finalPercent: '최종 평가에서 받은 네 항목의 절대 평가 평균을 반영합니다.',
  };
  const weightSettings = lockedWeights ? <section className="report-confirmed-weights" aria-label="확정된 평가 비중">
    <dl>{reportWeightFields.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>{lockedWeights[key]}%</dd></div>)}</dl>
    <p className="field-help">첫 리포트 생성 시 확정되어 모든 팀에 동일하게 적용됩니다.</p>
  </section> : (
    <fieldset className="report-weight-settings" disabled={busy || resource.loading}>
      <legend>평가 비중 설정</legend>
      <div className="report-weight-fields">
        {reportWeightFields.map(({ key, label }) => <Field key={key} label={`${label} 평가 비중`} help={weightDescriptions[key]}>
          <div className="report-weight-input">
            <input aria-label={`${label} 평가 비중`} type="number" min="0" max="100" step="1" required value={weights[key] ?? ''}
              aria-describedby="report-weight-guidance" aria-invalid={!weightsValid || undefined}
              onChange={(event) => setDraftWeights((current) => ({ ...current, [key]: event.target.value === '' ? null : event.target.valueAsNumber }))} />
            <span aria-hidden="true">%</span>
          </div>
        </Field>)}
      </div>
      <div className="report-weight-preview" aria-hidden="true">
        {weightsValid && reportWeightFields.map(({ key }, index) => <span key={key} className={`report-weight-segment report-weight-segment--${index}`} style={{ width: `${weights[key]}%` }} />)}
      </div>
      <p id="report-weight-guidance" className={weightsValid ? 'field-help' : 'notice'}>
        {lockedWeights ? '스페이스 공통 비율이 확정되어 변경할 수 없습니다.' : weightsValid ? '첫 리포트 생성 성공 시 모든 팀에 적용할 비율이 확정됩니다.' : '각 항목은 0~100의 정수이며, 합계가 100%여야 합니다.'}
        <span className="report-weight-total">합계 {totalWeight}%</span>
      </p>
      <div className="report-score-example" aria-label="가상 점수 계산 예시">
        <div><strong>계산 예시</strong><span>가상 점수 · 실제 팀원 결과가 아닙니다.</span></div>
        <dl>{reportWeightFields.map(({ key, label }, index) => <div key={key}><dt>{label}<small>{key === 'taskPercent' ? '100점' : key === 'midPercent' ? '4.0 / 5점 → 80점' : '4.5 / 5점 → 90점'}</small></dt>
          <dd>{exampleParts[index] === null ? '—' : exampleParts[index].toFixed(1)}점</dd></div>)}</dl>
        <p>종합점수 <strong>{exampleTotal === null ? '—' : exampleTotal.toFixed(1)} / 100점</strong></p>
      </div>
    </fieldset>
  );
  const weightContent = <div data-guide="report-weight-content">{weightSettings}
    {guidedManagement && guide.stepId === 'management-report-weights' && <div className="heading-actions preview-guide-inline-action">
      <button className="secondary-button" data-guide="confirm-management-report-weights" disabled={!guide.reportManagementReady}
        onClick={() => guide.confirmReportManagementStep('management-report-weights')}>생성 조건 확인 완료</button>
    </div>}
  </div>;
  return (
    <section className={`report-batch-generation${allGenerated ? ' is-generated' : ''}`} aria-label="전체 팀 리포트 생성" aria-busy={busy}>
      <div className="section-heading">
        <div>
          <h2>{allPublished ? '전체 리포트 공개 완료' : allGenerated ? '전체 리포트 생성 완료' : '전체 리포트 생성'}</h2>
          {state && <p>생성 {data.generatedTeamCount} / {data.totalTeamCount}팀 · 공개 {data.publishedTeamCount} / {data.totalTeamCount}팀</p>}
          {state && !allGenerated && <span className={`report-generation-status${state.canGenerate ? ' is-ready' : ''}`}>
            {state.canGenerate ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}
            {state.canGenerate ? '생성 가능' : '생성 대기'}
          </span>}
        </div>
      </div>
      <ErrorNotice error={confirmingPublication ? null : error} />
      <ResourceState resource={resource} label="전체 리포트 생성 조건">
        {state && !allGenerated && <>
          <ul className="readiness-list round-readiness" aria-label="팀별 리포트 준비 상태">
            {state.teams.map((team) => <li key={team.teamId} className={team.canGenerate ? 'is-complete' : ''}>
              {team.canGenerate ? <Check size={16} aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />}
              <strong>{team.teamName}</strong>
              <span>{team.reportId != null ? '생성 완료' : team.canGenerate ? '생성 가능' : '생성 대기'}</span>
              {!team.canGenerate && <span>{team.generationBlockReasons.map(reportBlockMessage).join(' · ')}</span>}
            </li>)}
          </ul>
          <details className="report-weights-disclosure" open={weightsOpen || (guidedManagement && guide.stepId === 'management-report-weights')}
            onToggle={(event) => setWeightsOpen(event.currentTarget.open)}>
            <summary>평가 비중 <span>{reportWeightFields.map(({ key, label }) => `${label} ${weights[key] ?? '—'}%`).join(' · ')}</span>
              <span className="report-weights-edit-label">{lockedWeights ? '확정 비율 보기' : '변경'}</span><ChevronDown size={14} aria-hidden="true" /></summary>
            {weightContent}
          </details>
          <div className="report-generation-action">
            <p>{state.canGenerate ? '팀별 결과를 검토한 뒤 전체 리포트를 한 번에 공개합니다.' :
              data.generationBlockReasons.map(reportBlockMessage).join(' · ') || '전체 팀 현황을 확인해 주세요.'}</p>
            <button type="button" className="primary-button" data-guide="generate-all-reports"
              disabled={busy || resource.loading || Boolean(resource.error) || !state.canGenerate || !weightsValid
                || (guidedManagement && guide.stepId === 'management-report-weights')}
              onClick={generateAll}>
              {busy ? '처리 중…' : data.generatedTeamCount > 0 ? '미생성 팀 다시 생성' : '전체 리포트 생성'}
            </button>
          </div>
        </>}
        {state && allGenerated && validReportWeights(lockedWeights) && <details className="report-weights-disclosure">
          <summary>적용된 평가 비중 <span>{reportWeightFields.map(({ key, label }) => `${label} ${weights[key]}%`).join(' · ')}</span><ChevronDown size={14} aria-hidden="true" /></summary>
          {weightContent}
        </details>}
        {state && allGenerated && !validReportWeights(lockedWeights) && <p className="field-help">확정된 반영 비율 정보를 다시 불러와 주세요.</p>}
      </ResourceState>
      {data && allGenerated && <div className="report-generation-action report-publication-action" data-guide="space-report-publication">
        <p>{allPublished ? '모든 팀에 리포트가 공개되었습니다.' : canPublish ? '팀별 결과를 검토한 뒤 전체 팀에 공개하세요.' : data.publicationBlockReasons.map(reportBlockMessage).join(' · ') || '공개 조건을 확인해 주세요.'}</p>
        {!allPublished && <button className="primary-button" data-guide="publish-all-reports" disabled={busy || !canPublish || (guidedManagement && guide.stepId !== 'management-report-publish')} onClick={openPublication}>전체 리포트 공개</button>}
      </div>}
      {guidedManagement && guide.stepId === 'management-report-result' && <div className="heading-actions">
        <button className="secondary-button" data-guide="confirm-management-report-result" disabled={!guide.reportManagementReady}
          onClick={() => guide.confirmReportManagementStep('management-report-result')}>공개 결과 확인 완료</button>
      </div>}
      {confirmingPublication && <Modal title="전체 리포트 공개" busy={busy} onClose={() => setConfirmingPublication(null)}>
        <p>미공개 {confirmingPublication.totalTeamCount - confirmingPublication.publishedTeamCount}개 팀의 리포트를 함께 공개합니다.</p>
        <p data-guide="report-publication-scope">각 팀원은 본인의 종합점수·평가 결과·작업 근거만 볼 수 있습니다. 공개 후에는 수정하거나 비공개로 되돌릴 수 없습니다.</p>
        {confirmingPublication.publishedTeamCount > 0 && <p className="field-help">이미 공개된 {confirmingPublication.publishedTeamCount}개 팀은 유지됩니다.</p>}
        <ErrorNotice error={error} />
        <div className="heading-actions"><button className="secondary-button" disabled={busy} onClick={() => setConfirmingPublication(null)}>취소</button>
          <button className="primary-button" data-guide="confirm-publish-all-reports" disabled={busy || resource.loading || Boolean(resource.error) || !canPublish} onClick={publishAll}>{busy ? '공개 중…' : '전체 공개 확정'}</button></div>
      </Modal>}

    </section>
  );
}
