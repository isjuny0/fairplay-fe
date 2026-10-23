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
  const [isQuestionInputOpen, setQuestionInputOpen] = useState(true);
  const busyRef = useRef(false);
  const active = useRef(true);
  const [reference, setReference] = useState(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusPage, setStatusPage] = useState(0);
  const input = useRef(null);
  const status = useResource(
    () => getRagIndexStatus(team.id, statusPage, 20),
    [team.id, statusPage],
  );
  const data = status.data;
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
    setQuestionInputOpen(false);
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
      setQuestionInputOpen(true);
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
    setQuestionInputOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  };
  return (
    <section className="rag-page stack">
      <header className="page-heading page-heading--compact rag-page-heading">
        <div>
          <h1>팀 자료 검색</h1>
          <p>팀 자료에 질문하고 답변의 근거를 확인합니다.</p>
        </div>
        <button className="secondary-button" onClick={() => openMaterials()}>
          <FileText size={16} />
          산출물 보기
        </button>
      </header>
      <div className="rag-availability" aria-label="검색 자료 현황">
        <div>
          {status.loading && !data ? (
            <span role="status">자료 준비 현황을 확인하는 중…</span>
          ) : data ? (
            <>
              <span className="rag-availability-item">
                <i />
                검색 가능{' '}
                <strong>{data.readyCount.toLocaleString()}</strong>개
              </span>
              {data.enabled && data.failedCount > 0 && (
                <span className="rag-status-warning">
                  준비 실패 {data.failedCount.toLocaleString()}개
                </span>
              )}
            </>
          ) : (
            <span>자료 준비 상태를 확인하지 못했습니다.</span>
          )}
        </div>
        <button className="rag-inline-link" onClick={() => setStatusOpen(true)}>
          자료 현황
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
          {isQuestionInputOpen ? (
            <form className="rag-question-form" onSubmit={ask}>
              <label htmlFor="rag-question">
                <Search size={17} />팀 자료에서 어떤 내용을 찾고 있나요?
              </label>
              <textarea
                id="rag-question"
                ref={input}
                rows={2}
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
                  {question.length.toLocaleString()} / 1,000
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
                  질문하기
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          ) : (
            <header className="rag-submitted-question">
              <div>
                <span className="rag-section-label">질문</span>
                <h2>{submittedQuestion}</h2>
              </div>
              {!busy && (
                <div className="rag-question-actions">
                  <button
                    className="secondary-button"
                    onClick={() => startQuestion(submittedQuestion)}
                  >
                    질문 수정
                  </button>
                  <button
                    className="rag-inline-link"
                    onClick={() => startQuestion()}
                  >
                    새 질문 <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </header>
          )}
          {isQuestionInputOpen && !submittedQuestion && !question && (
            <div className="rag-examples">
              <span className="rag-section-label">이렇게 질문해 보세요</span>
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
            </article>
          )}
        </div>
        {reference && !permissionError && (
          <RagSourcePanel
            key={`${reference.sourceId}:${reference.deliverableId}:${reference.deliverableVersion}:${reference.startLine}:${reference.endLine}`}
            teamId={team.id}
            reference={reference}
            onAccessError={(failure) => {
              setError(failure);
              setResult(null);
              setReference(null);
              setQuestionInputOpen(true);
            }}
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
          onClose={() => setStatusOpen(false)}
          onOpenMaterials={openMaterials}
        />
      )}
    </section>
  );
}
