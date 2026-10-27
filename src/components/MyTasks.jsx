import { useContext, useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useLocation } from 'react-router';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { listMyTasks } from '../api/personalWork.js';
import { formatDate, statusLabels } from '../lib/domain.js';
import { restrictionLabels } from '../lib/personalWork.js';
import { EmptyState, ResourceState } from './ui.jsx';
import { HeaderContext } from './HeaderContext.js';

const PAGE_SIZE = 20;
export default function MyTasks() {
  const navigate = useAppNavigate();
  const setHeaderContext = useContext(HeaderContext);
  const { pathname } = useLocation();
  const [pageNumber, setPageNumber] = useState(0);
  const resource = useResource(() => listMyTasks(pageNumber, PAGE_SIZE), [pageNumber]);
  const tasks = resource.data || [];
  useEffect(() => {
    setHeaderContext?.({ pathname, scope: '개인 업무', title: '할 일', detail: '내 할 일' });
  }, [setHeaderContext, pathname]);
  return <main className="main-content personal-work-page">
    <header className="page-heading"><div><h1>할 일</h1><p>모든 스페이스에서 내게 배정된 진행 중인 작업을 확인합니다.</p></div></header>
    <ResourceState resource={resource} label="할 일">
      {tasks.length ? <div className="table-scroll"><table className="data-table personal-task-table">
        <thead><tr><th scope="col">작업</th><th scope="col">상태</th><th scope="col">시작일</th><th scope="col">마감일</th><th scope="col">내 배분</th><th scope="col">작업 공간</th><th scope="col"><span className="sr-only">상세</span></th></tr></thead>
        <tbody>{tasks.map((task) => <tr key={task.taskId}>
          <td className="personal-task-title"><strong>{task.title}</strong>{task.isOverdue && <span className="task-overdue-label">마감 지남</span>}{task.workRestrictionReasons?.length > 0 && <ul className="task-restrictions">{task.workRestrictionReasons.map((reason) => <li key={reason}>{restrictionLabels[reason] || '현재 작업에 제한이 있습니다.'}</li>)}</ul>}</td>
          <td><span className={`status-badge task-state-${task.status.toLowerCase()}`}>{statusLabels[task.status] || task.status}</span></td>
          <td><time dateTime={task.startAt}>{formatDate(task.startAt)}</time></td>
          <td className={task.isOverdue ? 'is-overdue' : ''}><time dateTime={task.dueAt}>{formatDate(task.dueAt)}</time></td>
          <td>{task.myAllocationPercent}%</td><td><span>{task.spaceName}</span><small className="task-team-name">{task.teamName}</small></td>
          <td><button type="button" className="icon-button personal-task-open" aria-label={`${task.title} 상세 보기`} onClick={() => navigate(`/spaces/${task.spaceId}/teams/${task.teamId}/tasks/${task.taskId}`)}><ArrowUpRight size={17} /></button></td>
        </tr>)}</tbody>
      </table></div> : <EmptyState>현재 배정된 할 일이 없습니다.</EmptyState>}
    </ResourceState>
    {resource.data && <nav className="personal-work-pagination" aria-label="할 일 페이지">
      <button type="button" className="secondary-button" disabled={pageNumber === 0 || resource.loading} onClick={() => setPageNumber((value) => value - 1)}>이전</button>
      <span>{pageNumber + 1}페이지</span>
      <button type="button" className="secondary-button" disabled={tasks.length < PAGE_SIZE || resource.loading} onClick={() => setPageNumber((value) => value + 1)}>다음</button>
    </nav>}
  </main>;
}
