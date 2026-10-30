import { useContext, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { listMyTodos } from '../api/personalWork.js';
import { formatDate, statusLabels } from '../lib/domain.js';
import { restrictionLabels } from '../lib/personalWork.js';
import { teamMenuPath } from '../lib/routes.js';
import { pageNumbers } from '../lib/pageNumbers.js';
import { EmptyState, ResourceState } from './ui.jsx';
import { HeaderContext } from './HeaderContext.js';
import PersonalWorkBackButton from './PersonalWorkBackButton.jsx';

const PAGE_SIZE = 20;
export default function MyTasks() {
  const navigate = useAppNavigate();
  const setHeaderContext = useContext(HeaderContext);
  const { pathname } = useLocation();
  const [pageNumber, setPageNumber] = useState(0);
  const resource = useResource(() => listMyTodos(pageNumber, PAGE_SIZE), [pageNumber]);
  const todos = resource.data?.items || [];
  const totalPages = Math.ceil((resource.data?.totalCount || 0) / PAGE_SIZE);
  const visiblePages = pageNumbers(Math.min(pageNumber + 1, Math.max(1, totalPages)), totalPages, window.matchMedia('(max-width: 600px)').matches ? 7 : 10);
  useEffect(() => {
    setHeaderContext?.({ pathname, scope: '개인 업무', title: '할 일', detail: '내 할 일' });
  }, [setHeaderContext, pathname]);
  useEffect(() => {
    const lastPage = Math.max(0, totalPages - 1);
    if (resource.data && pageNumber > lastPage) setPageNumber(lastPage);
  }, [pageNumber, resource.data, totalPages]);
  return <main className="main-content personal-work-page">
    <header className="page-heading">
      <div><h1>할 일</h1><p>모든 스페이스에서 내 작업과 진행 중인 동료 평가를 확인합니다.</p></div>
      <PersonalWorkBackButton />
    </header>
    <ResourceState resource={resource} label="할 일">
      {todos.length ? <div className="table-scroll"><table className="data-table personal-task-table">
        <thead><tr><th scope="col">할 일</th><th scope="col">유형·상태</th><th scope="col">시작일</th><th scope="col">마감일</th><th scope="col">내 배분</th><th scope="col">작업 공간</th></tr></thead>
        <tbody>{todos.map((todo) => {
          const task = todo.task;
          const evaluation = todo.evaluation;
          const title = todo.title;
          const target = todo.type === 'TASK'
            ? `/spaces/${todo.spaceId}/teams/${todo.teamId}/tasks/${task?.taskId ?? todo.id}`
            : `${teamMenuPath(todo.spaceId, todo.teamId, '동료 평가')}?roundId=${evaluation.roundId}`;
          const openTodo = () => navigate(target);
          return <tr
            key={`${todo.type}-${todo.id}`}
            className="personal-task-row"
            tabIndex={0}
            aria-label={`${title} 상세 보기`}
            onClick={openTodo}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openTodo();
              }
            }}
          >
          <td className="personal-task-title"><strong>{title}</strong>{todo.isOverdue && <span className="task-overdue-label">마감 지남</span>}{task?.workRestrictionReasons?.length > 0 && <ul className="task-restrictions">{task.workRestrictionReasons.map((reason) => <li key={reason}>{restrictionLabels[reason] || '현재 작업에 제한이 있습니다.'}</li>)}</ul>}</td>
          <td>{todo.type === 'TASK' ? <span className={`status-badge task-state-${(task?.status || '').toLowerCase()}`}>{statusLabels[task?.status] || task?.status || '작업'}</span> : <span className="status-badge">{evaluation.roundType === 'MID' ? '중간 동료 평가' : '최종 동료 평가'}</span>}</td>
          <td>{task?.startAt ? <time dateTime={task.startAt}>{formatDate(task.startAt)}</time> : '—'}</td>
          <td className={todo.isOverdue ? 'is-overdue' : ''}><time dateTime={todo.dueAt}>{formatDate(todo.dueAt)}</time></td>
          <td>{task ? `${task.myAllocationPercent}%` : '—'}</td><td><span>{todo.spaceName}</span><small className="task-team-name">{todo.teamName}</small></td>
        </tr>})}</tbody>
      </table></div> : <EmptyState>현재 할 일이나 진행 중인 동료 평가가 없습니다.</EmptyState>}
    </ResourceState>
    {resource.data && totalPages > 1 && <nav className="personal-work-pagination" aria-label="할 일 페이지">
      <button type="button" className="personal-work-page-arrow" aria-label="이전 페이지" disabled={pageNumber === 0 || resource.loading} onClick={() => setPageNumber((value) => value - 1)}><ChevronLeft size={20} /></button>
      <div className="personal-work-page-numbers">{visiblePages.map((number) => <button
        type="button"
        className="personal-work-page-number"
        aria-label={`할 일 ${number}페이지`}
        aria-current={number === pageNumber + 1 ? 'page' : undefined}
        key={number}
        disabled={resource.loading}
        onClick={() => setPageNumber(number - 1)}
      >{number}</button>)}</div>
      <button type="button" className="personal-work-page-arrow" aria-label="다음 페이지" disabled={pageNumber + 1 >= totalPages || resource.loading} onClick={() => setPageNumber((value) => value + 1)}><ChevronRight size={20} /></button>
    </nav>}
  </main>;
}
