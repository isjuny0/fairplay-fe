import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { BookOpen, X } from 'lucide-react';
import { PreviewGuideContext } from '../lib/previewGuideContext.js';
import { completedGuideStep, guideTaskId, getGuideSteps, materialsGuideReady, materialsSourceGuideStep, contributionGuideReady, managerGuideReady, managerGuidePath, managerGuideMemberId, managerGuideMemberPath, managerGuideTaskId, managerGuideDeliverableId, evaluationGuideReady, evaluationGuideSchedule, reportManagementGuideReady, guideScenarios, nextGuideScenario, guideExamples, prepareGuide, readGuideSession, storeGuideSession, guideScopeKey, guideStorageKey } from '../mock/guide.js';
import { getMockState } from '../mock/planned.js';
import { previewContext, previewRole, setPreviewRole } from '../mock/preview.js';
import { workSummary } from '../lib/evaluation.js';
import { guideLocationMatches, isReportGuideDrawer } from '../lib/guideLocation.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { Modal } from './ui.jsx';
import PreviewGuideLauncher from './PreviewGuideLauncher.jsx';
import PreviewGuideCallout from './PreviewGuideCallout.jsx';
import PreviewGuideCompletion from './PreviewGuideCompletion.jsx';
import { managerGuideStep } from '../mock/guide.js';
import '../preview-guide.css';

export default function PreviewGuideProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm, confirmDiscard, notify } = useInteractions();
  const [previousSession] = useState(readGuideSession);
  const [guide, setGuide] = useState(null);
  const [aiFeedbackReady, setAiFeedbackReady] = useState(false);
  const [materialsState, setMaterialsState] = useState(null);
  const [materialsSource, setMaterialsSource] = useState(null);
  const [reportState, setReportState] = useState(null);
  const [managerState, setManagerState] = useState(null);
  const [managerSource, setManagerSource] = useState(null);
  const [evaluationState, setEvaluationState] = useState(null);
  const [managedReportBatch, setManagedReportBatch] = useState(null);
  const [managedReportResult, setManagedReportResult] = useState(null);
  const [managedReportReview, setManagedReportReview] = useState(null);
  const evaluationSchedule = useMemo(() => evaluationGuideSchedule(), [guide?.scope]);
  const reportReady = contributionGuideReady(reportState?.report, reportState?.userId);
  const initialized = useRef(false);
  const [launcher, setLauncher] = useState(false);
  const [launcherAudience, setLauncherAudience] = useState(() =>
    guideScenarios.find((scenario) => scenario.id === previousSession?.scenarioId)?.audience
      || (previewRole() === 'manager' ? 'manager' : 'member'));
  const [transitioning, setTransitioning] = useState(false);
  const switchingGuide = useRef(false);
  const [error, setError] = useState('');
  const toggle = useRef(null);
  const guiding = guide?.status === 'active';
  const steps = getGuideSteps(guide?.scenarioId);
  const resolvedStep = useMemo(() => {
    const current = managerGuideStep(steps[guide?.step ?? 0], {
      member: managerState, source: managerSource, reportResult: managedReportResult,
      reportReviewReady: reportManagementGuideReady('management-report-review', managedReportBatch, managedReportResult, managedReportReview),
    });
    if (current.id === 'materials-source') return materialsSourceGuideStep(current, { answer: materialsState?.answer, source: materialsSource });
    return current.id === 'ai-feedback' && aiFeedbackReady
      ? { ...current, description: current.readyDescription, target: current.readyTarget, actionTarget: current.readyActionTarget }
      : current;
  }, [steps, guide?.step, aiFeedbackReady, materialsState?.answer, materialsSource, managerState, managerSource,
    managedReportBatch, managedReportResult, managedReportReview]);
  // Step definitions contain only copy and selectors. Keep their identity when
  // background state changes without changing the instructions (e.g. typing
  // report weights), so guidance does not scroll or restart its pulse each time.
  const stepDefinition = JSON.stringify(resolvedStep);
  const step = useMemo(() => JSON.parse(stepDefinition), [stepDefinition]);
  const atLocation = location.pathname === step.path.split('?')[0];
  const atGuideSelection = guideLocationMatches(step, location);
  const [revealRequest, setRevealRequest] = useState(null);
  const update = useCallback((change) => setGuide((current) => {
    const next = typeof change === 'function' ? change(current) : change;
    storeGuideSession(next);
    return next;
  }), []);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (previousSession?.status !== 'active') return;
    try {
      // A reload starts a fresh isolated dataset at step one instead of resuming.
      const next = prepareGuide(previousSession.scenarioId);
      setGuide(next);
      window.dispatchEvent(new Event('fairplay:preview-updated'));
      navigate(getGuideSteps(next.scenarioId)[0].path, { replace: true });
    } catch {
      setError('가이드 예시 데이터를 준비하지 못했습니다. 다시 시작해 주세요.');
      setLauncher(true);
    }
  }, [previousSession, navigate]);
  const open = () => {
    toggle.current = document.activeElement;
    setLauncherAudience(guideScenarios.find((scenario) => scenario.id === guide?.scenarioId)?.audience
      || (previewRole() === 'manager' ? 'manager' : 'member'));
    setError('');
    setLauncher(true);
  };
  const stop = useCallback(() => update((current) => current ? { ...current, status: 'paused' } : null), [update]);
  const focusTarget = useCallback(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    const inStepDialog = atLocation && (dialog?.querySelector('h2')?.textContent === step.dialogTitle || (atGuideSelection && isReportGuideDrawer(dialog, step)));
    setRevealRequest({ scope: guide?.scope, stepId: step.id, inStepDialog });
    // Locating an open form should scroll that form, not navigate away from it.
    if (!atGuideSelection && !inStepDialog) navigate(step.path, { preventScrollReset: true, state: location.state });
  }, [step, guide?.scope, atLocation, atGuideSelection, navigate, location.state]);
  useEffect(() => {
    if (!revealRequest) return;
    if (!guiding || revealRequest.scope !== guide.scope || revealRequest.stepId !== step.id) {
      setRevealRequest(null);
      return;
    }
    // Expire even if navigation is blocked or the destination fails to load.
    const timeout = setTimeout(() => setRevealRequest(null), 6000);
    if (!atGuideSelection && !revealRequest.inStepDialog) return () => clearTimeout(timeout);
    // A route can load lazily; restore local tabs only after their listener is
    // mounted, then wait for React to render the requested section.
    let sectionRequested = false;
    const reveal = () => {
      const dialog = [...document.querySelectorAll('[role="dialog"]')].at(-1);
      const reportDrawer = isReportGuideDrawer(dialog, step);
      if (dialog && !reportDrawer && dialog.querySelector('h2')?.textContent !== step.dialogTitle) return false;
      if (!dialog && !atGuideSelection) return false;
      if (dialog && !reportDrawer && step.dialogSection) {
        window.dispatchEvent(new CustomEvent('fairplay:guide-focus', { detail: step.dialogSection }));
        if (!sectionRequested) { sectionRequested = true; return false; }
      }
      if (!dialog && step.section) {
        window.dispatchEvent(new CustomEvent('fairplay:guide-focus', { detail: step.section }));
        if (!sectionRequested) { sectionRequested = true; return false; }
      }
      const root = dialog || document;
      const selectors = dialog && !reportDrawer ? [step.dialogActionTarget, step.dialogTarget] : [step.calloutTarget, step.actionTarget, step.target];
      const target = selectors.filter(Boolean)
        .map((selector) => [...root.querySelectorAll(selector)].find((element) =>
          element.getClientRects().length && !element.disabled && !element.closest('[hidden]')
          && getComputedStyle(element).visibility === 'visible')).find(Boolean);
      if (!target) return false;
      const callout = root.querySelector('.preview-guide-callout:not(.is-docked)');
      const flowHost = callout?.closest('.preview-guide-callout-host');
      (flowHost || target).scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      if (target.matches('input, textarea, button, summary')) target.focus({ preventScroll: true });
      setRevealRequest(null);
      return true;
    };
    let interval;
    // Let route heading focus and entry motion finish before moving focus again.
    const startTimer = setTimeout(() => {
      if (!reveal()) interval = setInterval(() => { if (reveal()) clearInterval(interval); }, 100);
    }, 400);
    return () => { clearTimeout(startTimer); clearInterval(interval); clearTimeout(timeout); };
  }, [revealRequest, guiding, atGuideSelection, guide?.scope, step, location.key]);
  useEffect(() => {
    if (!guiding) return;
    const advance = () => {
      if (completedGuideStep(guide, location.pathname)) update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
    };
    advance();
    window.addEventListener('fairplay:preview-saved', advance);
    return () => window.removeEventListener('fairplay:preview-saved', advance);
  }, [guiding, guide?.step, guide?.scope, location.pathname, update]);
  useEffect(() => {
    if (!guiding || !atLocation || step.id !== 'materials-question'
      || !materialsGuideReady(step.id, materialsState)) return;
    update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
  }, [guiding, atLocation, step.id, guide?.step, materialsState, update]);
  useEffect(() => {
    if (!guiding || guide.scenarioId !== 'team-management') return;
    const selectedTeam = step.id === 'manager-select-team' && location.pathname === managerGuidePath
      && new URLSearchParams(location.search).get('teamId') === '1';
    const selectedMember = step.id === 'manager-overview' && location.pathname === managerGuideMemberPath;
    if (!(selectedTeam || selectedMember) || !managerGuideReady(step.id, managerState)) return;
    update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
  }, [guiding, guide?.scenarioId, guide?.step, step.id, location.pathname, location.search, managerState, update]);
  useEffect(() => {
    if (!guiding || !atLocation || guide.scenarioId !== 'evaluation-management'
      || !['evaluation-schedule', 'evaluation-open'].includes(step.id) || !evaluationGuideReady(step.id, evaluationState)) return;
    update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
  }, [guiding, atLocation, guide?.scenarioId, guide?.step, step.id, evaluationState, update]);
  useEffect(() => {
    if (!guiding || !atLocation || guide.scenarioId !== 'report-management'
      || !['management-report-generate', 'management-report-publish'].includes(step.id)
      || !reportManagementGuideReady(step.id, managedReportBatch, managedReportResult, managedReportReview)) return;
    update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
  }, [guiding, atLocation, guide?.scenarioId, guide?.step, step.id, managedReportBatch, managedReportResult, managedReportReview, update]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('guide') !== 'start') return;
    setLauncher(true);
    params.delete('guide');
    navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, { replace: true });
  }, [location.search, location.pathname, location.hash, navigate]);
  useEffect(() => {
    if (!guiding || !atLocation) return;
    // Pulse the real controls; guidance never submits or activates them.
    const highlighted = new Map();
    const highlight = () => {
      const dialog = [...document.querySelectorAll('[role="dialog"]')].at(-1);
      const isStepDialog = dialog?.querySelector('h2')?.textContent === step.dialogTitle;
      const reportDrawer = isReportGuideDrawer(dialog, step);
      const root = dialog || document;
      const readSelector = dialog && !reportDrawer ? (isStepDialog ? step.dialogTarget : null) : step.target;
      const actionSelector = dialog && !reportDrawer ? (isStepDialog ? step.dialogActionTarget : null) : step.actionTarget;
      const next = new Map();
      for (const [selector, className] of [[readSelector, 'preview-guide-highlight'], [actionSelector, 'preview-guide-action-highlight']]) {
        if (!selector) continue;
        for (const target of root.querySelectorAll(selector)) {
          if (target.getClientRects().length && !target.disabled && !target.closest('[hidden]')
            && getComputedStyle(target).visibility === 'visible') next.set(target, className);
        }
      }
      for (const [target, className] of highlighted) {
        if (next.get(target) !== className) {
          target.classList.remove(className);
          highlighted.delete(target);
        }
      }
      for (const [target, className] of next) {
        if (!highlighted.has(target)) {
          target.classList.add(className);
          highlighted.set(target, className);
        }
      }
    };
    const observer = new MutationObserver(highlight);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled', 'data-guide', 'open', 'class'] });
    highlight();
    return () => {
      observer.disconnect();
      for (const [target, className] of highlighted) target.classList.remove(className);
    };
  }, [guiding, atLocation, guide?.step, step]);
  const start = async (scenarioId) => {
    if (switchingGuide.current || !guideScenarios.some((scenario) => scenario.id === scenarioId && scenario.available)) return;
    switchingGuide.current = true;
    setTransitioning(true);
    setError('');
    try {
      if (!(await confirmDiscard())) return;
      const next = prepareGuide(scenarioId);
      update(next);
      setAiFeedbackReady(false);
      setMaterialsState(null);
      setMaterialsSource(null);
      setReportState(null);
      setManagerState(null);
      setManagerSource(null);
      setEvaluationState(null);
      setManagedReportBatch(null);
      setManagedReportResult(null);
      setManagedReportReview(null);
      setLauncher(false);
      window.dispatchEvent(new Event('fairplay:preview-updated'));
      navigate(getGuideSteps(next.scenarioId)[0].path);
    } catch { setError('가이드 예시 데이터를 준비하지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.'); }
    finally { switchingGuide.current = false; setTransitioning(false); }
  };
  const freeExplore = async () => {
    if (switchingGuide.current) return;
    switchingGuide.current = true;
    setTransitioning(true);
    setError('');
    try {
      if (!(await confirmDiscard())) return;
      const originalRole = guide?.originalRole ?? previousSession?.originalRole;
      if (originalRole) setPreviewRole(originalRole);
      sessionStorage.removeItem(guideScopeKey);
      sessionStorage.removeItem(guideStorageKey);
      setGuide(null);
      setLauncher(false);
      window.dispatchEvent(new Event('fairplay:preview-updated'));
      navigate('/preview/main');
    } catch { setError('자유 탐색으로 이동하지 못했습니다. 다시 시도해 주세요.'); }
    finally { switchingGuide.current = false; setTransitioning(false); }
  };
  const finish = () => {
    const context = previewContext();
    const task = getMockState(context).teams[1]?.tasks.find((item) => item.id === guideTaskId);
    if (task?.status !== 'DONE') {
      notify('작업을 완료한 뒤 가이드를 마쳐 주세요.');
      return;
    }
    update((current) => ({ ...current, status: 'completed' }));
    notify('수행 기록과 산출물을 남기고 작업을 완료했습니다.');
  };
  const action = () => {
    if (!atLocation) return focusTarget();
    if (step.id === 'result') finish();
    else focusTarget();
  };
  const progress = guiding && step.id === 'result' && atLocation ? (() => {
    const context = previewContext();
    return workSummary(1, context.user.id, getMockState(context).teams[1].tasks).teamProgressRate;
  })() : null;
  const confirmAiFeedback = () => {
    if (!guiding || step.id !== 'ai-feedback' || !aiFeedbackReady || !atLocation) return;
    if (!completedGuideStep(guide, location.pathname, { aiFeedbackConfirmed: true })) return;
    update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
  };
  const confirmMaterialsStep = (stepId) => {
    if (!guiding || !atLocation || guide.scenarioId !== 'materials-search' || step.id !== stepId
      || !materialsGuideReady(stepId, { ...materialsState, source: materialsSource })) return;
    if (stepId === 'materials-source') {
      update((current) => ({ ...current, status: 'completed' }));
      notify('팀 자료의 답변과 근거 원문을 확인했습니다.');
    } else if (stepId === 'materials-overview' || stepId === 'materials-answer') {
      update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
    }
  };
  const confirmPeerStep = (stepId) => {
    if (!guiding || !atLocation || guide.scenarioId !== 'peer-evaluation' || step.id !== stepId
      || !completedGuideStep(guide, location.pathname, { peerConfirmed: true })) return;
    if (stepId === 'peer-overview') {
      update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
    } else if (stepId === 'peer-result') {
      update((current) => ({ ...current, status: 'completed' }));
      notify('동료 평가의 대상별 저장과 최종 제출을 완료했습니다.');
    }
  };
  const confirmReportStep = (stepId) => {
    if (!guiding || !atLocation || guide.scenarioId !== 'contribution-report' || step.id !== stepId || !reportReady) return;
    if (stepId === 'report-components') {
      update((current) => ({ ...current, status: 'completed' }));
      notify('나의 최종 기여율과 항목별 반영 크기를 확인했습니다.');
    } else if (stepId === 'report-overview') {
      update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
    }
  };
  const confirmManagerStep = (stepId) => {
    if (!guiding || !atLocation || guide.scenarioId !== 'team-management' || step.id !== stepId
      || !managerGuideReady(stepId, managerState, managerSource)) return;
    if (stepId === 'manager-member') {
      update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
    } else if (stepId === 'manager-material') {
      update((current) => ({ ...current, status: 'completed' }));
      notify('팀 진행 상황과 팀원의 수행 기록·산출물을 확인했습니다.');
    }
  };
  const confirmEvaluationStep = (stepId) => {
    if (!guiding || !atLocation || guide.scenarioId !== 'evaluation-management' || step.id !== stepId
      || !evaluationGuideReady(stepId, evaluationState)) return false;
    if (stepId === 'evaluation-overview') {
      update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
    } else if (stepId === 'evaluation-result') {
      update((current) => ({ ...current, status: 'completed' }));
      notify('중간 평가를 시작하고 팀별 제출 현황을 확인했습니다.');
    }
    return true;
  };
  const confirmReportManagementStep = (stepId) => {
    if (!guiding || !atLocation || guide.scenarioId !== 'report-management' || step.id !== stepId
      || !reportManagementGuideReady(stepId, managedReportBatch, managedReportResult, managedReportReview)) return false;
    if (stepId === 'management-report-weights' || stepId === 'management-report-review') {
      update((current) => current?.step === guide.step ? { ...current, step: current.step + 1 } : current);
    } else if (stepId === 'management-report-result') {
      update((current) => ({ ...current, status: 'completed' }));
      notify('전체 팀 리포트를 생성하고 검토한 팀의 결과를 공개했습니다.');
    }
    return true;
  };
  const endForSettings = async () => {
    if (!guiding) return true;
    if (!(await confirm({ title: '사용자 가이드 종료', message: '역할이나 예시 상황을 바꾸면 현재 안내를 종료합니다. 가이드를 다시 시작하면 첫 단계부터 진행합니다.', label: '안내 종료 후 변경' }))) return false;
    stop();
    return true;
  };
  const currentScenario = guideScenarios.find((scenario) => scenario.id === guide?.scenarioId);
  const nextScenario = nextGuideScenario(guide?.scenarioId);
  const guideTitle = currentScenario?.title || '사용자 가이드';
  const calloutStep = useMemo(() => step.id === 'result' && !atLocation
    ? { ...step, target: '.task-next-action', actionTarget: null, calloutTarget: null, returnToGuide: true,
      title: '완료한 작업의 반영 결과를 확인하세요', description: '작업을 완료했습니다. ‘팀 홈에서 진행률 확인’을 눌러 처음 진행률과 현재 진행률을 비교해 보세요.' } : step, [step, atLocation]);
  const panel = <>
    {guiding && <GuideBar guide={guide} stepCount={steps.length} atLocation={atLocation} action={action} stop={stop} title={guideTitle} reveal={focusTarget} />}
    {!guiding && guide?.status === 'completed' && <PreviewGuideCompletion key={guide.scope}
      scenario={currentScenario} next={nextScenario} busy={transitioning} error={error}
      onNext={() => start(nextScenario.id)} onList={open} onExplore={freeExplore}
      onDismiss={() => update((current) => ({ ...current, status: 'paused' }))} />}
  </>;
  return <PreviewGuideContext.Provider value={{ open, stop, endForSettings, guiding, scope: guide?.scope, scenarioId: guide?.scenarioId, reportManagementReady: reportManagementGuideReady(step.id, managedReportBatch, managedReportResult, managedReportReview), reportManagementTeamId: 1, reportManagementMemberId: managerGuideMemberId, setManagedReportBatch, setManagedReportResult, setManagedReportReview, confirmReportManagementStep, evaluationSchedule, evaluationReady: evaluationGuideReady(step.id, evaluationState), setEvaluationState, confirmEvaluationStep, managerTaskId: managerGuideTaskId, managerDeliverableId: managerGuideDeliverableId, setManagerState, setManagerSource, confirmManagerStep, reportReady, setReportState, confirmReportStep, confirmPeerStep, setMaterialsState, setMaterialsSource, confirmMaterialsStep, step: guide?.step, stepId: step.id, section: step.section, aiFeedbackReady, setAiFeedbackReady, confirmAiFeedback, taskId: guideTaskId, examples: guideExamples, panel }}>
    {children}
    {guiding && (atLocation || step.id === 'result') && <PreviewGuideCallout key={guide.scope} guide={guide} step={calloutStep} stepCount={steps.length} action={action} reveal={atLocation ? focusTarget : action} progress={progress} />}
    {launcher && <Modal title="사용자 가이드" className="preview-guide-launcher" onClose={() => { setLauncher(false); toggle.current?.focus(); }}>
      <PreviewGuideLauncher onStart={start} onFreeExplore={freeExplore} initialAudience={launcherAudience} busy={transitioning} />
      {error && <p role="alert">{error}</p>}
    </Modal>}

  </PreviewGuideContext.Provider>;
}

function GuideBar({ guide, stepCount, atLocation, action, stop, title, reveal }) {
  return <aside className="preview-guide-bar is-compact" aria-label="Fairplay 사용자 가이드">
    <div className="preview-guide-heading">
      <BookOpen size={17} aria-hidden="true" /><span>{guide.step + 1} / {stepCount}</span><strong>{title}</strong>
      <button className="ghost-button preview-guide-locate" onClick={atLocation ? reveal : action}>{atLocation ? '안내 위치' : '가이드로 돌아가기'}</button>
      <button className="icon-button" aria-label="사용자 가이드 종료" onClick={stop}><X size={16} /></button>
    </div>
    <div className="preview-guide-progress" role="progressbar" aria-label={`${title} 진행 단계`}
      aria-valuemin={0} aria-valuemax={stepCount} aria-valuenow={guide.step}
      aria-valuetext={`${stepCount}단계 중 ${guide.step}단계 완료, ${guide.step + 1}단계 진행 중`}>
      {Array.from({ length: stepCount }, (_, index) => <span key={index} aria-hidden="true"
        className={index < guide.step ? 'is-complete' : index === guide.step ? 'is-current' : ''} />)}
    </div>
  </aside>;
}
