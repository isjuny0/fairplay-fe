import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  FileSearch,
  FileText,
  RefreshCw,
  Search,
} from 'lucide-react';
import { askTeamMaterials, getRagIndexStatus } from '../api/rag.js';
import { canUseRagMockApis } from '../api/ragPlanned.js';
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
import RagIndexStatus from './RagIndexStatus.jsx';
import '../team-rag.css';

export default function TeamRagSearch({ context }) {
  const { team, user } = context;
  return <TeamMaterialSearch key={`${team.id}:${user.id}`} context={context} />;
}
function TeamMaterialSearch({ context }) {
  const { team, space } = context;
  const navigate = useAppNavigate();
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [inputError, setInputError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const active = useRef(true);
  const [reference, setReference] = useState(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusPage, setStatusPage] = useState(0);
  const [scenario, setScenario] = useState('ready');
  const input = useRef(null);
  const mockAvailable = canUseRagMockApis();
  const status = useResource(
    () => getRagIndexStatus(team.id, statusPage, 20),
    [team.id, statusPage, scenario],
  );
  const data = status.data;
  useEffect(() => {
    let mounted = true;
    if (mockAvailable)
      import('../mock/preview.js').then(({ getRagPreviewScenario }) => {
        if (mounted) setScenario(getRagPreviewScenario());
      });
    return () => {
      mounted = false;
    };
  }, [mockAvailable]);
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
    if (!statusOpen || !data?.enabled || !data.preparingCount || status.error)
      return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') status.reload();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [
    statusOpen,
    data?.enabled,
    data?.preparingCount,
    status.error,
    status.reload,
  ]);
  const openMaterials = (title = '') =>
    navigate(
      `${teamMenuPath(space.id, team.id, '산출물')}${title ? `?${new URLSearchParams({ q: title })}` : ''}`,
    );
  const permissionError =
    [401, 403, 404].includes(error?.status) ||
    [401, 403, 404].includes(status.error?.status);
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
    try {
      const answer = await askTeamMaterials(team.id, submitted);
      if (!active.current) return;
      if (answer.teamId !== team.id)
        throw new Error('요청한 팀의 답변을 확인하지 못했습니다.');
      setResult(answer);
    } catch (failure) {
      if (!active.current) return;
      setError(failure);
      if (failure.code === 'RAG_SOURCE_CHANGED') status.reload();
    } finally {
      if (active.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };
  const changeScenario = async (value) => {
    const { setRagPreviewScenario } = await import('../mock/preview.js');
    setRagPreviewScenario(value);
    setScenario(value);
    setStatusPage(0);
    setReference(null);
    setResult(null);
    setError(null);
  };
  return (
    <section className="rag-page stack">
      <header className="page-heading page-heading--compact rag-page-heading">
        <div>
          <h1>팀 자료 검색</h1>
          <p>팀에 등록된 자료를 바탕으로 답변과 근거를 확인합니다.</p>
        </div>
        <button className="secondary-button" onClick={() => openMaterials()}>
          <FileText size={16} />
          산출물 보기
        </button>
      </header>
      {mockAvailable && (
        <label className="rag-preview-options">
          자료 검색 미리보기 상황
          <select
            value={scenario}
            disabled={busy}
            onChange={(event) => changeScenario(event.target.value)}
          >
            <option value="ready">검색 가능</option>
            <option value="no-evidence">관련 근거 없음</option>
            <option value="preparing">자료 준비 중</option>
            <option value="failed">준비 실패·재시도</option>
            <option value="disabled">기능 비활성화</option>
          </select>
          <span>답변·추가 API는 예시입니다.</span>
        </label>
      )}
      <div className="rag-availability" aria-label="검색 자료 현황">
        <div>
          {status.loading && !data ? (
            <span role="status">자료 준비 현황을 확인하는 중…</span>
          ) : data ? (
            <>
              <span className="rag-availability-item">
                <i />
                검색 가능한 자료{' '}
                <strong>{data.readyCount.toLocaleString()}</strong>개
              </span>
              {data.preparingCount > 0 && (
                <span>준비 중 {data.preparingCount.toLocaleString()}개</span>
              )}
              {data.failedCount > 0 && (
                <span className="rag-status-warning">
                  준비 실패 {data.failedCount.toLocaleString()}개
                </span>
              )}
              {data.unsupportedCount > 0 && (
                <span>
                  지원하지 않는 형식 {data.unsupportedCount.toLocaleString()}개
                </span>
              )}
            </>
          ) : (
            <span>자료 준비 상태를 확인하지 못했습니다.</span>
          )}
        </div>
        <button className="rag-inline-link" onClick={() => setStatusOpen(true)}>
          자료 현황 보기
          <ArrowUpRight size={14} />
        </button>
      </div>
      <ErrorNotice error={status.error} onRetry={status.reload} />
      {data && !data.enabled && (
        <p className="notice" role="status">
          현재 자료 질문 기능이 비활성화되어 있습니다. 등록된 자료는 산출물에서
          확인할 수 있습니다.
        </p>
      )}
      {data?.enabled && data.readyCount === 0 && (
        <p className="notice" role="status">
          {data.preparingCount
            ? '자료를 검색할 수 있도록 준비하고 있습니다. 준비가 완료되면 질문할 수 있습니다.'
            : '검색 가능한 자료가 없습니다. 산출물에 문서를 작성하거나 UTF-8 TXT·MD 파일을 등록해 주세요.'}
          <button
            className="rag-inline-link"
            disabled={status.loading}
            onClick={status.reload}
          >
            <RefreshCw size={14} />
            준비 상태 확인
          </button>
        </p>
      )}
      <div className={`rag-workspace ${reference ? 'has-source' : ''}`}>
        <div className="rag-main">
          <form className="rag-question-form" onSubmit={ask}>
            <label htmlFor="rag-question">
              <Search size={17} />팀 자료에서 어떤 내용을 찾고 있나요?
            </label>
            <textarea
              id="rag-question"
              ref={input}
              rows={3}
              maxLength={1000}
              value={question}
              disabled={busy || permissionError}
              placeholder="기능 정책, 회의에서 정한 내용, 조사 결과를 질문해 보세요."
              aria-invalid={Boolean(inputError)}
              aria-describedby={
                inputError ? 'rag-input-error' : 'rag-input-help'
              }
              onChange={(event) => {
                setQuestion(event.target.value);
                setInputError('');
              }}
            />
            {inputError && (
              <p id="rag-input-error" className="field-error" role="alert">
                {inputError}
              </p>
            )}
            <div className="rag-question-footer">
              <span id="rag-input-help">
                팀에 등록된 자료만 검색합니다.{' '}
                <small>{question.length.toLocaleString()} / 1,000</small>
              </span>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  busy ||
                  permissionError ||
                  !data?.enabled ||
                  !data.readyCount ||
                  Boolean(status.error) ||
                  !question.trim()
                }
              >
                {busy ? '답변 작성 중…' : '질문하기'}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
          {!submittedQuestion && (
            <div className="rag-examples">
              <span className="rag-section-label">이렇게 질문해 보세요</span>
              {ragExamples.map((example) => (
                <button
                  key={example}
                  disabled={busy || permissionError}
                  onClick={() => {
                    setQuestion(example);
                    setInputError('');
                    input.current?.focus();
                  }}
                >
                  {example}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          )}
          {busy && (
            <div className="rag-loading" role="status">
              <span className="rag-loading-dot" />
              관련 자료를 찾아 답변을 작성하고 있습니다. 잠시만 기다려 주세요.
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
                  : '질문을 수정하거나 질문하기를 눌러 다시 요청할 수 있습니다.'}
              </small>
            </div>
          )}
          {result && !permissionError && (
            <article
              className="rag-answer"
              aria-label="자료 검색 답변"
              aria-live="polite"
            >
              <header>
                <span className="rag-section-label">질문</span>
                <h2>{submittedQuestion}</h2>
              </header>
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
                            aria-pressed={reference === item}
                            aria-label={`${item.title} 원문 확인`}
                            onClick={() => setReference(item)}
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
                </>
              ) : (
                <section className="rag-no-evidence">
                  <FileSearch size={24} />
                  <h3>등록된 자료에서 확인할 수 없습니다.</h3>
                  <p>{noEvidenceMessage(result.reason)}</p>
                  <button
                    className="secondary-button"
                    onClick={() => setStatusOpen(true)}
                  >
                    자료 준비 현황 확인
                  </button>
                </section>
              )}
              <footer className="rag-answer-note">
                답변은 등록된 자료를 바탕으로 작성됩니다. 중요한 결정은 근거
                원문을 함께 확인해 주세요.
              </footer>
            </article>
          )}
          {!result && !error && !busy && (
            <div className="rag-search-help">
              <FileSearch size={24} />
              <h2>흩어진 팀 자료에서 근거를 찾아보세요.</h2>
              <p>
                기획서·회의 기록·조사 결과에 담긴 내용을 확인할 수 있습니다.
              </p>
              <span>현재 지원: 작성한 문서, UTF-8 TXT·MD 파일</span>
            </div>
          )}
        </div>
        {reference && !permissionError && (
          <RagSourcePanel
            key={`${reference.sourceId}:${reference.deliverableId}`}
            teamId={team.id}
            reference={reference}
            mockAvailable={mockAvailable}
            onClose={() => setReference(null)}
            onOpenMaterials={() => openMaterials(reference.title)}
          />
        )}
      </div>
      {statusOpen && (
        <RagIndexStatus
          resource={status}
          page={statusPage}
          setPage={setStatusPage}
          teamId={team.id}
          mockAvailable={mockAvailable}
          onClose={() => setStatusOpen(false)}
          onOpenMaterials={openMaterials}
        />
      )}
    </section>
  );
}
