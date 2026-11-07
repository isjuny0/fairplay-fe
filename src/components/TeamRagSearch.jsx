import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  FileSearch,
  PanelRightOpen,
} from 'lucide-react';
import { askTeamMaterials, getRagIndexStatus } from '../api/rag.js';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { teamMenuPath } from '../lib/routes.js';
import {
  ragExamples,
  ragQuestionError,
  ragErrorGuidance,
  noEvidenceMessage,
  sourceLocation,
} from '../lib/rag.js';
import { ErrorNotice } from './ui.jsx';
import MarkdownBody from './MarkdownBody.jsx';
import RagSourcePanel from './RagSourcePanel.jsx';
import RagMaterialList from './RagMaterialList.jsx';
import '../team-rag.css';

export default function TeamRagSearch({ context }) {
  const { team, user } = context;
  const guide = usePreviewGuide();
  return <TeamMaterialSearch key={`${team.id}:${user.id}:${guide?.scope || 'free'}`} context={context} />;
}
function TeamMaterialSearch({ context }) {
  const { team, space } = context;
  const navigate = useAppNavigate();
  const guide = usePreviewGuide();
  const guidedMaterials = Boolean(guide?.guiding && guide.scenarioId === 'materials-search' && team.id === 1);
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [inputError, setInputError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const active = useRef(true);
  const [reference, setReference] = useState(null);
  const [isMaterialsOpen, setMaterialsOpen] = useState(false);
  const [isSplitView, setSplitView] = useState(false);
  const [statusPage, setStatusPage] = useState(0);
  const input = useRef(null);
  const conversation = useRef(null);
  const workspace = useRef(null);
  const sidePanel = useRef(null);
  const materialsToggle = useRef(null);
  const status = useResource(
    () => getRagIndexStatus(team.id, statusPage, 20),
    [team.id, statusPage],
  );
  const data = status.data;
  const reportMaterialsState = guide?.setMaterialsState;
  useEffect(() => {
    if (!guidedMaterials) return;
    reportMaterialsState({ status: !status.loading && !status.error ? data : null, answer: !busy && !error ? result : null });
    return () => reportMaterialsState(null);
  }, [guidedMaterials, reportMaterialsState, status.loading, status.error, data, busy, error, result]);
  useEffect(() => {
    if (!guidedMaterials || guide.stepId !== 'materials-question') return;
    setQuestion((current) => current || guide.examples.question);
    setReference(null);
    setMaterialsOpen(false);
  }, [guidedMaterials, guide?.stepId, guide?.examples.question]);
  const permissionError =
    [401, 403, 404].includes(error?.status) ||
    [401, 403, 404].includes(status.error?.status);
  const autoRefreshingMaterials = !permissionError && (isSplitView || isMaterialsOpen)
    && !reference && Boolean(data?.enabled && data.preparingCount > 0) && !status.error;
  useEffect(() => {
    // Match the workspace container query, including sidebar width changes.
    const observer = new ResizeObserver(([entry]) => {
      setSplitView(entry.contentRect.width >= 720);
    });
    observer.observe(workspace.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const refresh = () => status.reload();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [status.reload]);
  useEffect(() => {
    if (!autoRefreshingMaterials) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') status.reload();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [autoRefreshingMaterials, status.reload]);
  useEffect(() => {
    conversation.current?.scrollTo({ top: 0 });
  }, [submittedQuestion]);
  const openMaterials = (title = '') =>
    navigate(
      `${teamMenuPath(space.id, team.id, '팀 자료')}${title ? `?${new URLSearchParams({ q: title })}` : ''}`,
    );
  const showMaterials = () => {
    setReference(null);
    setMaterialsOpen(true);
    requestAnimationFrame(() => {
      sidePanel.current?.querySelector('[data-materials-list]')?.focus({ preventScroll: true });
    });
  };
  const closeMaterials = () => {
    setReference(null);
    setMaterialsOpen(false);
    requestAnimationFrame(() => materialsToggle.current?.focus());
  };
  const ask = async (event) => {
    event.preventDefault();
    if (
      busyRef.current ||
      permissionError ||
      !data?.enabled ||
      !data.readyCount ||
      status.error
    )
      return;
    const validation = ragQuestionError(question);
    setInputError(validation);
    if (validation) {
      input.current?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    setReference(null);
    const submitted = question.trim();
    setSubmittedQuestion(submitted);
    setQuestion('');
    try {
      const answer = await askTeamMaterials(team.id, submitted);
      if (!active.current) return;
      if (answer.teamId !== team.id)
        throw new Error('요청한 팀의 답변을 확인하지 못했습니다.');
      setResult(answer);
    } catch (failure) {
      if (!active.current) return;
      setError(failure);
      setQuestion(submitted);
      if (failure.code === 'RAG_SOURCE_CHANGED') status.reload();
    } finally {
      if (active.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };
  const startQuestion = (previousQuestion = '') => {
    setQuestion(previousQuestion);
    setSubmittedQuestion('');
    setInputError('');
    setReference(null);
    setResult(null);
    setError(null);
    requestAnimationFrame(() => input.current?.focus());
  };
  return (
    <section className="rag-page stack">
      <header className="page-heading page-heading--compact rag-page-heading">
        <div>
          <h1>팀 자료 검색</h1>
        </div>
        <div className="rag-page-actions">
          <button
            className="secondary-button rag-mobile-materials-toggle"
            onClick={showMaterials}
            data-guide="open-materials"
            ref={materialsToggle}
            aria-expanded={isMaterialsOpen}
            aria-controls="rag-materials-panel"
          >
            <PanelRightOpen size={16} />
            팀 자료
          </button>
        </div>
      </header>
      {guidedMaterials && <p className="field-help">사용자 가이드의 예시 답변입니다. 실제 AI 모델을 호출하지 않습니다.</p>}
      {status.error && !isMaterialsOpen && (
        <div className="rag-mobile-status-error">
          <ErrorNotice error={status.error} onRetry={status.reload} />
        </div>
      )}
      {data && !data.enabled && (
        <p className="notice" role="status">
          현재 자료 질문 기능이 비활성화되어 있습니다. 등록된 자료는 팀 자료에서
          확인할 수 있습니다.
        </p>
      )}
      {data?.enabled && data.readyCount === 0 && (
        <p className="notice" role="status">
          {data.preparingCount
            ? '자료를 검색할 수 있도록 준비하고 있습니다. 준비가 완료되면 질문할 수 있습니다.'
            : '검색 가능한 자료가 없습니다. 문서를 작성하거나 UTF-8 TXT·MD 또는 텍스트가 있는 PDF를 등록해 주세요.'}
          <button className="rag-inline-link" onClick={showMaterials}>
            팀 자료 확인
          </button>
        </p>
      )}
      <div className={`rag-workspace ${isMaterialsOpen ? 'is-materials-open' : ''} ${!submittedQuestion && !error ? 'is-welcome' : ''}`} ref={workspace}>
        <div className="rag-main">
          <div
            className="rag-conversation"
            ref={conversation}
            role="region"
            aria-label="질문과 답변"
            tabIndex={0}
          >
            {!submittedQuestion && !error && (
              <div className="rag-welcome">
                <h2>팀 자료에서 어떤 내용을 찾고 있나요?</h2>
                <div className="rag-examples">
                  {ragExamples.slice(0, 2).map((example) => (
                    <button
                      key={example}
                      disabled={busy || permissionError}
                      onClick={() => {
                        setQuestion(example);
                        setInputError('');
                        input.current?.focus();
                      }}
                    >
                      {example}<ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {submittedQuestion && !error && !permissionError && (
              <div className="rag-submitted-question">
                <div className="rag-question-message">
                  <span className="sr-only">내 질문</span>
                  <h2>{submittedQuestion}</h2>
                </div>
                {!busy && (
                  <button
                    className="rag-message-edit"
                    onClick={() => startQuestion(submittedQuestion)}
                  >
                    질문 수정
                  </button>
                )}
              </div>
            )}
            {busy && (
              <div className="rag-loading" role="status">
                <div className="rag-loading-label">
                  <span className="rag-loading-dot" aria-hidden="true" />
                  관련 자료를 찾아 답변을 작성하고 있습니다.
                </div>
                <div className="rag-loading-lines" aria-hidden="true"><span /><span /><span /></div>
              </div>
            )}
            {error && (
              <div className="rag-question-error" role="alert">
                <strong>답변을 확인하지 못했습니다.</strong>
                <p>{ragErrorGuidance(error)}</p>
                <small>
                  입력한 질문은 유지됩니다.{' '}
                  {permissionError
                    ? '팀 참여 상태와 접근 권한을 확인해 주세요.'
                    : '질문을 수정한 뒤 다시 보내주세요.'}
                </small>
              </div>
            )}
            {result && !permissionError && (
              <article
                className="rag-answer"
                aria-label="자료 검색 답변"
                aria-live="polite"
              >
                {result.answerable ? (
                  <>
                    <section className="rag-answer-body">
                      <h3>답변</h3>
                      <MarkdownBody>{result.answer}</MarkdownBody>
                    </section>
                    {result.limitations.length > 0 && (
                      <section className="rag-limitations">
                        <h3>확인이 필요한 내용</h3>
                        <ul>
                          {result.limitations.map((limitation, index) => (
                            <li key={index}>{limitation}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                    <section className="rag-references">
                      <h3>
                        근거 자료 <span>{result.references.length}</span>
                      </h3>
                      <ol>
                        {result.references.map((item, index) => (
                          <li key={`${item.sourceId}:${index}`}>
                            <button
                              className={`rag-reference ${reference === item ? 'is-selected' : ''}`}
                              data-guide="open-material-citation"
                              aria-pressed={reference === item}
                              aria-label={`${item.title} 원문 확인`}
                              onClick={() => { setReference(item); setMaterialsOpen(true); }}
                            >
                              <span className="rag-reference-number">
                                {index + 1}
                              </span>
                              <span className="rag-reference-body">
                                <strong>{item.title}</strong>
                                <small>{sourceLocation(item)}</small>
                                <q>{item.quote}</q>
                                <span className="rag-reference-action">
                                  원문 확인
                                  <ArrowUpRight size={14} />
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </section>
                    {guidedMaterials && guide.stepId === 'materials-answer' && result.references.length > 0 && (
                      <div className="heading-actions preview-guide-inline-action">
                        <button className="secondary-button" data-guide="confirm-material-answer"
                          onClick={() => guide.confirmMaterialsStep('materials-answer')}>답변 확인 완료</button>
                      </div>
                    )}
                  </>
                ) : (
                  <section className="rag-no-evidence">
                    <FileSearch size={24} />
                    <h3>등록된 자료에서 확인할 수 없습니다.</h3>
                    <p>{noEvidenceMessage(result.reason)}</p>
                    <button
                      className="secondary-button"
                      onClick={showMaterials}
                    >
                      팀 자료 확인
                    </button>
                  </section>
                )}
              </article>
            )}
          </div>
          <form className="rag-question-form" onSubmit={ask}>
            <label className="sr-only" htmlFor="rag-question">
              팀 자료에서 어떤 내용을 찾고 있나요?
            </label>
            <textarea
              id="rag-question"
              ref={input}
              rows={2}
              maxLength={1000}
              value={question}
              disabled={busy || permissionError}
              placeholder={busy
                ? '자료에서 답변을 찾고 있습니다…'
                : '예: 인터뷰에서 발견한 주요 문제는 무엇인가요?'}
              aria-invalid={Boolean(inputError)}
              aria-describedby={inputError ? 'rag-input-error' : undefined}
              onChange={(event) => {
                setQuestion(event.target.value);
                setInputError('');
              }}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' && !event.shiftKey &&
                  !event.nativeEvent.isComposing && event.keyCode !== 229
                ) {
                  event.preventDefault();
                  event.currentTarget.form.requestSubmit();
                }
              }}
            />
            {inputError && (
              <p id="rag-input-error" className="field-error" role="alert">{inputError}</p>
            )}
            <div className="rag-question-footer">
              <div className="rag-send-actions">
                <span className="rag-character-count" aria-label="질문 글자 수">{question.length.toLocaleString()} / 1,000</span>
                <button
                  className="primary-button rag-send-button"
                  type="submit"
                  data-guide="send-material-question"
                  aria-label={busy ? '답변 작성 중' : '질문 보내기'}
                  disabled={
                    busy || permissionError || !data?.enabled || !data.readyCount ||
                    Boolean(status.error) || !question.trim()
                  }
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
            {submittedQuestion && !busy && !permissionError && (
              <div className="rag-question-tools">
                <button type="button" className="rag-reset-question" onClick={() => startQuestion()}>
                  새 질문으로 시작
                </button>
              </div>
            )}
          </form>
        </div>
        <div className="rag-side-panel" id="rag-materials-panel" ref={sidePanel}>
          <div className="rag-list-view" hidden={Boolean(reference) && !permissionError}>
            <RagMaterialList
              resource={permissionError
                ? { ...status, data: null, error: error || status.error }
                : status}
              page={statusPage}
              setPage={setStatusPage}
              onSelect={(item) => { setReference(item); setMaterialsOpen(true); }}
              onDismiss={closeMaterials}
              active={!reference}
              autoRefreshing={autoRefreshingMaterials}
            />
          </div>
          {reference && !permissionError && (
            <RagSourcePanel
              key={`${reference.sourceId || 'material'}:${reference.deliverableId}:${reference.deliverableVersion}:${reference.pageNumber}:${reference.startLine}:${reference.endLine}`}
              teamId={team.id}
              reference={reference}
              onAccessError={(failure) => {
                setError(failure);
                setResult(null);
                setReference(null);
                setMaterialsOpen(false);
                setQuestion((current) => current || submittedQuestion);
              }}
              onBack={() => setReference(null)}
              onDismiss={closeMaterials}
              onOpenMaterials={() => openMaterials(reference.title)}
            />
          )}
        </div>
      </div>
    </section>
  );
}
