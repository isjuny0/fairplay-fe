import { useEffect, useMemo, useState } from 'react';
import {
  addTaskEvidence,
  completeMockEvidenceScan,
  confirmTaskAssignment,
  getTaskDetail,
  requestTaskCompletion,
  updateTaskProgress,
} from '../api/taskDetail.js';

const statusLabels = { TODO: '할 일', IN_PROGRESS: '진행 중', PENDING_APPROVAL: '승인 대기', DONE: '완료' };
const evidenceLabels = { TEXT: '텍스트', URL: 'URL', FILE: '파일' };
const scanLabels = { SCANNING: '검사 중', CLEAN: '사용 가능', FAILED: '검사 실패', INFECTED: '사용 불가' };

function formatDate(value, withTime = false) {
  if (!value) return '미정';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '미정';
  return new Intl.DateTimeFormat('ko-KR', withTime ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function formatSize(size) {
  if (!Number.isFinite(size)) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

export default function TaskDetail({ team, taskId, viewerId, onBack, onTaskUpdated }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [evidenceType, setEvidenceType] = useState('TEXT');
  const [criterionId, setCriterionId] = useState('');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceValue, setEvidenceValue] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);

  useEffect(() => {
    if (!team?.id || !taskId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    getTaskDetail(team.id, taskId)
      .then((nextTask) => {
        if (cancelled) return;
        setTask(nextTask);
        setProgressNote(nextTask.progressNote || '');
        setCriterionId(nextTask.criteria?.[0]?.id || '');
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || '작업 상세를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [team?.id, taskId]);

  const blockers = useMemo(() => {
    if (!task) return [];
    const reasons = [];
    if (task.status === 'TODO') reasons.push('작업을 먼저 시작해 주세요.');
    if (task.status !== 'IN_PROGRESS') reasons.push('진행 중인 작업만 완료 요청할 수 있습니다.');
    if (task.assignees?.some((assignee) => !assignee.confirmedAt)) reasons.push('모든 담당자의 배분 확인이 필요합니다.');
    if (!task.criteria?.length || task.criteria.some((criterion) => !criterion.completed)) reasons.push('모든 완료 기준에 근거를 연결해 주세요.');
    if (!task.evidences?.length) reasons.push('수행 근거를 한 개 이상 등록해 주세요.');
    if (task.evidences?.some((evidence) => evidence.scanStatus !== 'CLEAN')) reasons.push('파일 검사가 완료될 때까지 기다려 주세요.');
    return [...new Set(reasons)];
  }, [task]);

  const updateTask = (nextTask) => {
    setTask(nextTask);
    setProgressNote(nextTask.progressNote || '');
    onTaskUpdated?.(nextTask);
  };

  const runAction = async (name, action) => {
    setBusyAction(name);
    setActionError('');
    try { updateTask(await action()); } catch (requestError) { setActionError(requestError.message || '요청을 처리하지 못했습니다.'); }
    finally { setBusyAction(''); }
  };

  const handleEvidenceSubmit = async (event) => {
    event.preventDefault();
    if (!criterionId) { setActionError('연결할 완료 기준을 선택해 주세요.'); return; }
    if (evidenceType === 'FILE' && !evidenceFile) { setActionError('첨부할 파일을 선택해 주세요.'); return; }
    if (evidenceType === 'FILE' && evidenceFile.size > 25 * 1024 * 1024) { setActionError('근거 파일은 25MB 이하만 등록할 수 있습니다.'); return; }
    if (evidenceType !== 'FILE' && !evidenceValue.trim()) { setActionError('근거 내용을 입력해 주세요.'); return; }
    if (evidenceType === 'URL') {
      try { new URL(evidenceValue.trim()); } catch { setActionError('http:// 또는 https://로 시작하는 URL을 입력해 주세요.'); return; }
    }

    setBusyAction('evidence');
    setActionError('');
    try {
      const nextTask = await addTaskEvidence(team.id, task.id, {
        type: evidenceType, criterionId, title: evidenceTitle.trim(), value: evidenceValue.trim(), file: evidenceFile,
      });
      updateTask(nextTask);
      setEvidenceTitle('');
      setEvidenceValue('');
      setEvidenceFile(null);
      const scanningEvidence = nextTask.evidences.find((evidence) => evidence.scanStatus === 'SCANNING');
      if (scanningEvidence) {
        completeMockEvidenceScan(team.id, task.id, scanningEvidence.id).then(updateTask).catch(() => {});
      }
    } catch (requestError) { setActionError(requestError.message || '수행 근거를 등록하지 못했습니다.'); }
    finally { setBusyAction(''); }
  };

  if (loading) return <section className="task-detail-loading" aria-label="작업 상세 불러오는 중"><div/><div/><div/></section>;
  if (error) return <section className="dashboard-error" role="alert"><strong>작업 상세를 불러오지 못했습니다.</strong><p>{error}</p><button type="button" className="secondary-button" onClick={onBack}>작업 보드로 돌아가기</button></section>;
  if (!task) return null;

  const viewerAssignment = task.assignees?.find((assignee) => String(assignee.userId || assignee.id) === String(viewerId));
  const pending = task.status === 'PENDING_APPROVAL' || task.approvalStatus === 'PENDING';
  const completed = task.status === 'DONE';
  const locked = pending || completed;

  return <section className="task-detail-page">
    <button type="button" className="back-button" onClick={onBack}>← 작업 보드</button>
    <header className="task-detail-header">
      <div><div className="task-detail-status-line"><span className={`task-status status-${task.status.toLowerCase().replaceAll('_', '-')}`}>{statusLabels[task.status] || task.status}</span><span>{task.milestoneName || '마일스톤 미지정'}</span></div><h1>{task.title}</h1><p>{task.description || '작업 설명이 없습니다.'}</p></div>
      <dl className="task-overview-meta"><div><dt>가중치</dt><dd>{task.weight}</dd></div><div><dt>마감</dt><dd>{formatDate(task.dueAt)}</dd></div><div><dt>검토자</dt><dd>{task.reviewer?.name || task.reviewerName || '미지정'}</dd></div></dl>
    </header>

    {actionError && <div className="inline-error" role="alert"><span>{actionError}</span><button type="button" onClick={() => setActionError('')}>닫기</button></div>}
    {task.rejectionReason && <div className="task-rejection" role="status"><strong>반려 사유</strong><span>{task.rejectionReason}</span></div>}

    <div className="task-detail-grid">
      <div className="task-detail-main">
        <section className="detail-panel"><div className="section-heading"><h2>담당 배분</h2><span>합계 {task.assignees?.reduce((sum, item) => sum + Number(item.allocationPercent || 0), 0)}%</span></div><ul className="assignment-list">{task.assignees?.map((assignee) => {
          const isViewer = String(assignee.userId || assignee.id) === String(viewerId);
          return <li key={assignee.userId || assignee.id}><div><span className="member-avatar" aria-hidden="true">{assignee.name?.slice(0, 1)}</span><span><strong>{assignee.name}</strong><small>{assignee.allocationPercent}% 담당</small></span></div>{assignee.confirmedAt ? <span className="confirmation-state is-confirmed">확인 완료 · {formatDate(assignee.confirmedAt, true)}</span> : isViewer && !locked ? <button type="button" className="secondary-button compact-button" disabled={busyAction === 'confirm'} onClick={() => runAction('confirm', () => confirmTaskAssignment(team.id, task.id, viewerId))}>{busyAction === 'confirm' ? '확인 중...' : '내 배분 확인'}</button> : <span className="confirmation-state">확인 대기</span>}</li>;
        })}</ul>{!viewerAssignment && <p className="panel-note">담당자만 본인의 배분을 확인할 수 있습니다.</p>}</section>

        <section className="detail-panel"><div className="section-heading"><h2>완료 기준</h2><span>{task.criteria?.filter((criterion) => criterion.completed).length || 0}/{task.criteria?.length || 0} 충족</span></div><ul className="criteria-list">{task.criteria?.map((criterion) => <li key={criterion.id} className={criterion.completed ? 'is-complete' : ''}><span aria-hidden="true">{criterion.completed ? '✓' : '○'}</span><div><strong>{criterion.description}</strong><small>반영 비율 {criterion.weightPercent}% · 연결 근거 {task.evidences?.filter((evidence) => evidence.criterionId === criterion.id).length || 0}건</small></div></li>)}</ul></section>

        <section className="detail-panel progress-panel"><div className="section-heading"><h2>진행 내용</h2></div><label className="field-label" htmlFor="task-progress">현재 진행 상황과 다음 행동</label><textarea id="task-progress" rows="4" value={progressNote} disabled={locked} onChange={(event) => setProgressNote(event.target.value)} placeholder="현재까지 진행한 내용과 다음 계획을 적어 주세요."/><div className="panel-actions"><button type="button" className="secondary-button" disabled={locked || busyAction === 'progress' || progressNote === (task.progressNote || '')} onClick={() => runAction('progress', () => updateTaskProgress(team.id, task.id, progressNote.trim()))}>{busyAction === 'progress' ? '저장 중...' : '진행 내용 저장'}</button></div></section>

        <section className="detail-panel"><div className="section-heading"><h2>수행 근거</h2><span>{task.evidences?.length || 0}건</span></div>{task.evidences?.length ? <ul className="evidence-list">{task.evidences.map((evidence) => <li key={evidence.id}><div className="evidence-icon" aria-hidden="true">{evidence.type === 'FILE' ? '▣' : evidence.type === 'URL' ? '↗' : '≡'}</div><div className="evidence-copy"><div><strong>{evidence.title}</strong><span className={`scan-status scan-${evidence.scanStatus?.toLowerCase()}`}>{scanLabels[evidence.scanStatus] || evidenceLabels[evidence.type]}</span></div>{evidence.body && <p>{evidence.body}</p>}{evidence.url && <a href={evidence.url} target="_blank" rel="noreferrer">{evidence.url}</a>}{evidence.fileName && <p>{evidence.fileName} · {formatSize(evidence.fileSize)}</p>}<small>{evidence.authorName} · {formatDate(evidence.createdAt, true)}</small></div></li>)}</ul> : <p className="panel-empty">아직 등록된 수행 근거가 없습니다.</p>}
          {locked ? <p className="panel-note">완료 요청 이후에는 수행 근거를 수정할 수 없습니다.</p> : <form className="evidence-form" onSubmit={handleEvidenceSubmit}><h3>근거 추가</h3><div className="evidence-form-row"><label>유형<select value={evidenceType} onChange={(event) => { setEvidenceType(event.target.value); setEvidenceValue(''); setEvidenceFile(null); }}><option value="TEXT">텍스트</option><option value="URL">URL</option><option value="FILE">파일</option></select></label><label>완료 기준<select value={criterionId} onChange={(event) => setCriterionId(event.target.value)}>{task.criteria?.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.description}</option>)}</select></label></div><label>제목<input value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} placeholder="근거를 알아보기 쉬운 제목"/></label>{evidenceType === 'FILE' ? <label>파일<input type="file" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)}/><small>최대 25MB · 등록 후 검사 상태가 표시됩니다.</small></label> : <label>{evidenceType === 'URL' ? 'URL' : '내용'}<textarea rows="3" value={evidenceValue} onChange={(event) => setEvidenceValue(event.target.value)} placeholder={evidenceType === 'URL' ? 'https://...' : '수행한 내용과 확인 방법을 적어 주세요.'}/></label>}<button type="submit" className="secondary-button" disabled={busyAction === 'evidence'}>{busyAction === 'evidence' ? '등록 중...' : '근거 등록'}</button></form>}
        </section>
      </div>

      <aside className="task-detail-side">
        <section className="completion-panel"><h2>완료 요청</h2>{pending ? <div className="completion-state"><strong>검토 대기 중</strong><p>{task.reviewer?.name || task.reviewerName || '검토자'}에게 완료 요청을 보냈습니다.</p></div> : completed ? <div className="completion-state is-complete"><strong>승인 완료</strong><p>검토가 완료된 작업입니다.</p></div> : <><p>담당 배분과 완료 기준, 수행 근거를 확인한 뒤 검토를 요청하세요.</p>{blockers.length > 0 && <ul className="completion-blockers">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}<button type="button" className="primary-button" disabled={blockers.length > 0 || busyAction === 'completion'} onClick={() => runAction('completion', () => requestTaskCompletion(team.id, task.id))}>{busyAction === 'completion' ? '요청 중...' : task.approvalStatus === 'REJECTED' ? '완료 다시 요청' : '완료 요청'}</button></>}</section>
        <section className="detail-panel history-panel"><div className="section-heading"><h2>작업 이력</h2></div><ol>{task.history?.map((history) => <li key={history.id}><span aria-hidden="true"/><div><strong>{history.label}</strong><p>{history.detail}</p><small>{history.actorName} · {formatDate(history.createdAt, true)}</small></div></li>)}</ol></section>
      </aside>
    </div>
  </section>;
}
