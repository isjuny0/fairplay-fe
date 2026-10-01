import { useEffect, useMemo, useState } from 'react';
import { createTask, getTaskBoard, updateTaskStatus } from '../api/taskBoard.js';
import TaskDetail from './TaskDetail.jsx';

const columns = [
  { id: 'TODO', label: '할 일' },
  { id: 'IN_PROGRESS', label: '진행 중' },
  { id: 'PENDING_APPROVAL', label: '승인 대기' },
  { id: 'DONE', label: '완료' },
];
const statusLabels = Object.fromEntries(columns.map((column) => [column.id, column.label]));
const nextStatus = { TODO: 'IN_PROGRESS' };
const nextActionLabels = { TODO: '작업 시작' };

function formatDate(value) {
  if (!value) return '마감 미정';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '마감 미정';
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(date);
}

function isOverdue(task) {
  return !['DONE'].includes(task.status) && task.dueAt && new Date(task.dueAt).getTime() < Date.now();
}

function TaskCard({ task, changingId, onStatusChange, onOpen }) {
  const actionStatus = nextStatus[task.status];
  return <article className="board-task-card" aria-label={`${task.title}, ${statusLabels[task.status] || task.status}`}>
    <div className="board-task-heading"><span className={`task-status status-${task.status.toLowerCase().replaceAll('_', '-')}`}>{statusLabels[task.status] || task.status}</span><span className="task-weight">가중치 {task.weight}</span></div>
    <button type="button" className="task-title-button" onClick={() => onOpen(task.id)}><h3>{task.title}</h3></button>
    <dl className="task-card-meta">
      <div><dt>담당</dt><dd>{task.assignees?.map((assignee) => assignee.name).join(', ') || '미지정'}</dd></div>
      <div><dt>마감</dt><dd className={isOverdue(task) ? 'is-overdue' : ''}>{formatDate(task.dueAt)}{isOverdue(task) ? ' · 지연' : ''}</dd></div>
      <div><dt>근거</dt><dd>{task.evidenceCount ? `${task.evidenceCount}건` : '없음'}</dd></div>
      <div><dt>검토자</dt><dd>{task.reviewerName || '미지정'}</dd></div>
    </dl>
    {task.status === 'DONE' && task.aiScore != null && <p className="task-ai-result">AI 평가 {task.aiScore}점</p>}
    {task.status === 'PENDING_APPROVAL' ? <p className="task-state-help">{task.reviewerName || '검토자'}의 확인을 기다리고 있습니다.</p> : actionStatus ? <button type="button" className="secondary-button compact-button task-state-button" disabled={changingId === task.id} onClick={() => onStatusChange(task, actionStatus)}>{changingId === task.id ? '변경 중...' : nextActionLabels[task.status]}</button> : <button type="button" className="secondary-button compact-button task-state-button" onClick={() => onOpen(task.id)}>상세 보기</button>}
  </article>;
}

function TaskModal({ members, submitting, error, onClose, onSubmit }) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ title: '', assigneeId: members[0]?.userId || '', weight: '3', dueAt: tomorrow });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><h2 id="task-modal-title">새 작업 만들기</h2><button type="button" className="icon-button" aria-label="닫기" onClick={onClose}>×</button></div><form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}><div className="form-fields"><div><label className="field-label" htmlFor="task-title">작업 제목</label><input id="task-title" autoFocus maxLength="80" value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="예: 사용자 인터뷰 결과 정리"/></div><div><label className="field-label" htmlFor="task-assignee">담당자</label><select id="task-assignee" value={form.assigneeId} onChange={(event) => update('assigneeId', event.target.value)}>{members.map((member) => <option key={member.userId || member.id} value={member.userId || member.id}>{member.name || member.userName}</option>)}</select></div><div className="task-form-row"><div><label className="field-label" htmlFor="task-weight">가중치</label><select id="task-weight" value={form.weight} onChange={(event) => update('weight', event.target.value)}>{[1, 2, 3, 5, 8].map((weight) => <option key={weight} value={weight}>{weight}</option>)}</select></div><div><label className="field-label" htmlFor="task-due">마감일</label><input id="task-due" type="date" min={new Date().toISOString().slice(0, 10)} value={form.dueAt} onChange={(event) => update('dueAt', event.target.value)}/></div></div></div>{error && <p className="form-error" role="alert">{error}</p>}<p className="field-help">생성된 작업은 할 일 상태로 등록됩니다. 담당 배분과 완료 기준은 작업 상세에서 확정합니다.</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? '생성 중...' : '작업 생성'}</button></div></form></section></div>;
}

export default function TaskBoard({ team, userId }) {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState('board');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [changingId, setChangingId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  useEffect(() => {
    if (!team?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    getTaskBoard(team.id).then((result) => {
      if (!cancelled) { setTasks(result.tasks); setMembers(result.members); }
    }).catch((requestError) => {
      if (!cancelled) setError(requestError.message || '작업 보드를 불러오지 못했습니다.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [team?.id, reloadKey]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const statusMatches = statusFilter === 'ALL' || task.status === statusFilter;
    const assigneeMatches = assigneeFilter === 'ALL' || task.assignees?.some((assignee) => String(assignee.userId || assignee.id) === assigneeFilter);
    return statusMatches && assigneeMatches;
  }), [tasks, statusFilter, assigneeFilter]);

  if (!team) return <section className="empty-state"><p>참여 중인 팀이 없습니다.</p><span>팀에 가입한 뒤 작업 보드를 사용할 수 있습니다.</span></section>;
  if (loading) return <section className="task-board-loading" aria-label="작업 보드 불러오는 중"><div/><div/><div/><div/></section>;
  if (error) return <section className="dashboard-error" role="alert"><strong>작업 보드를 불러오지 못했습니다.</strong><p>{error}</p><button type="button" className="secondary-button" onClick={() => setReloadKey((key) => key + 1)}>다시 시도</button></section>;

  if (selectedTaskId) return <TaskDetail team={team} taskId={selectedTaskId} viewerId={userId} onBack={() => setSelectedTaskId(null)} onTaskUpdated={(updatedTask) => setTasks((current) => current.map((item) => item.id === updatedTask.id ? updatedTask : item))}/>;

  const handleCreate = async (form) => {
    if (!form.title.trim()) { setFormError('작업 제목을 입력해 주세요.'); return; }
    if (!form.assigneeId) { setFormError('담당자를 선택해 주세요.'); return; }
    if (!form.dueAt) { setFormError('마감일을 선택해 주세요.'); return; }
    setSubmitting(true); setFormError('');
    try {
      const task = await createTask(team.id, { ...form, title: form.title.trim() });
      setTasks((current) => [...current, task]);
      setStatusFilter('ALL');
      setModalOpen(false);
    } catch (requestError) { setFormError(requestError.message || '작업을 생성하지 못했습니다.'); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (task, status) => {
    setChangingId(task.id); setError('');
    try {
      const updated = await updateTaskStatus(team.id, task.id, status);
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    } catch (requestError) { setError(requestError.message || '상태를 변경하지 못했습니다.'); }
    finally { setChangingId(null); }
  };

  return <section className="task-board-page">
    <div className="page-heading"><div><h1>작업 보드</h1><p>{team.name}의 작업과 승인 상태를 한눈에 확인하세요.</p></div><button type="button" className="primary-button" onClick={() => { setFormError(''); setModalOpen(true); }}>작업 만들기</button></div>
    <div className="task-toolbar">
      <div className="task-filters"><label>상태<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">전체 상태</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label><label>담당자<select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="ALL">전체 담당자</option>{members.map((member) => <option key={member.userId || member.id} value={member.userId || member.id}>{member.name || member.userName}</option>)}</select></label></div>
      <div className="view-switch" aria-label="보기 방식"><button type="button" className={view === 'board' ? 'is-active' : ''} aria-pressed={view === 'board'} onClick={() => setView('board')}>보드</button><button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>목록</button></div>
    </div>
    {tasks.length === 0 ? <section className="empty-state task-empty"><p>아직 등록된 작업이 없습니다.</p><span>첫 작업을 만들고 담당자와 마감을 정해 보세요.</span><button type="button" className="primary-button" onClick={() => setModalOpen(true)}>첫 작업 만들기</button></section> : filteredTasks.length === 0 ? <section className="empty-state task-empty"><p>조건에 맞는 작업이 없습니다.</p><span>필터를 변경하면 다른 작업을 확인할 수 있습니다.</span><button type="button" className="secondary-button" onClick={() => { setStatusFilter('ALL'); setAssigneeFilter('ALL'); }}>필터 초기화</button></section> : view === 'board' ? <div className="task-columns">{columns.map((column) => {
      const columnTasks = filteredTasks.filter((task) => task.status === column.id);
      return <section className="task-column" key={column.id} aria-labelledby={`column-${column.id}`}><div className="task-column-heading"><h2 id={`column-${column.id}`}>{column.label}</h2><span>{columnTasks.length}</span></div><div className="task-column-list">{columnTasks.length === 0 ? <p>작업 없음</p> : columnTasks.map((task) => <TaskCard key={task.id} task={task} changingId={changingId} onStatusChange={handleStatusChange} onOpen={setSelectedTaskId}/>)}</div></section>;
    })}</div> : <div className="task-list-view">{filteredTasks.map((task) => <TaskCard key={task.id} task={task} changingId={changingId} onStatusChange={handleStatusChange} onOpen={setSelectedTaskId}/>)}</div>}
    {modalOpen && <TaskModal members={members} submitting={submitting} error={formError} onClose={() => { if (!submitting) setModalOpen(false); }} onSubmit={handleCreate}/>} 
  </section>;
}
