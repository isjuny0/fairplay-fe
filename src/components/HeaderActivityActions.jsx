import { useEffect, useRef, useState } from 'react';
import { Bell, ListTodo, CheckCheck } from 'lucide-react';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { getMyNotificationUnreadCount, listMyNotifications, listAllMyTodos, markNotificationRead } from '../api/personalWork.js';
import { announceNotificationChange, notificationPath } from '../lib/personalWork.js';
import { formatDate, statusLabels } from '../lib/domain.js';
import { teamMenuPath } from '../lib/routes.js';

export default function HeaderActivityActions() {
  const navigate = useAppNavigate();
  const { notify } = useInteractions();
  const [open, setOpen] = useState(false);
  const [taskPopoverOpen, setTaskPopoverOpen] = useState(false);
  const [taskPreview, setTaskPreview] = useState(null);
  const [taskPreviewError, setTaskPreviewError] = useState(false);
  const [todoType, setTodoType] = useState('ALL');
  const root = useRef(null);
  const taskRequest = useRef(null);
  const count = useResource(getMyNotificationUnreadCount, []);
  const recent = useResource(() => listMyNotifications({ filter: 'UNREAD', accessibleOnly: true, size: 5 }), []);

  useEffect(() => {
    const update = () => { count.reload(); recent.reload(); };
    window.addEventListener('fairplay:notifications-changed', update);
    const outside = (event) => {
      if (!root.current?.contains(event.target)) {
        setOpen(false);
        setTaskPopoverOpen(false);
      }
    };
    const key = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setTaskPopoverOpen(false);
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('fairplay:notifications-changed', update);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
    };
  }, [count.reload, recent.reload]);

  const openNotification = (item) => {
    setOpen(false);
    navigate(notificationPath(item) || '/notifications');
    if (!item.readAt) {
      void markNotificationRead(item.id)
        .then(announceNotificationChange)
        .catch(() => notify('알림을 읽음으로 표시하지 못했습니다.'));
    }
  };

  const loadTaskPreview = () => {
    if (taskRequest.current) return;
    taskRequest.current = listAllMyTodos().then((items) => {
      setTaskPreview(items);
      setTaskPreviewError(false);
    }).catch(() => {
      setTaskPreviewError(true);
      taskRequest.current = null;
    });
  };

  const taskCountLabel = `할 일·평가 ${taskPreview?.totalCount ?? 0}개`;
  const visibleTodos = taskPreview?.items.filter(item => todoType === 'ALL' || item.type === todoType) || [];

  const openTodo = (todo) => {
    setTaskPopoverOpen(false);
    const path = todo.type === 'TASK'
      ? `${teamMenuPath(todo.spaceId, todo.teamId, '작업')}/${todo.task?.taskId ?? todo.id}`
      : `${teamMenuPath(todo.spaceId, todo.teamId, '동료 평가')}?roundId=${todo.evaluation.roundId}`;
    navigate(path);
  };

  return (
    <div className="header-activity-actions" ref={root}>
      <div className="header-activity-item">
        <button className="header-activity-button" type="button" aria-label="알림함" onClick={() => { setTaskPopoverOpen(false); setOpen((value) => !value); }} aria-expanded={open}>
          <Bell size={19} />
          {count.data > 0 && <span className="notification-count">{count.data > 99 ? '99+' : count.data}</span>}
        </button>
      </div>
      <div className="header-activity-item">
        <button className="header-activity-button" type="button" aria-label="할 일" aria-expanded={taskPopoverOpen} aria-controls="header-task-popover" onClick={() => {
          setOpen(false);
          if (!taskPopoverOpen) loadTaskPreview();
          setTaskPopoverOpen((value) => !value);
        }}>
          <ListTodo size={19} />
        </button>
        {taskPopoverOpen && <section className="notification-popover header-task-popover" id="header-task-popover" aria-label="할 일 미리보기">
          <header className="notification-popover-heading"><strong>{taskPreviewError ? '할 일을 불러오지 못했습니다' : taskPreview === null ? '할 일을 불러오는 중…' : taskCountLabel}</strong>{taskPreview && !taskPreviewError && todoType !== 'ALL' && <span className="field-help">전체 기준</span>}</header>
          {taskPreview && !taskPreviewError && <div className="todo-kind-filter" role="group" aria-label="할 일 종류">
            {[["ALL", "전체"], ["TASK", "작업"], ["PEER_EVALUATION", "동료 평가"]].map(([type, label]) => <button key={type} type="button" aria-pressed={todoType === type} onClick={() => setTodoType(type)}>{label}</button>)}
          </div>}
          {taskPreviewError ? <p className="notification-popover-state">잠시 후 다시 확인해 주세요.</p> : taskPreview === null ? <p className="notification-popover-state" role="status">담당 중인 작업과 동료 평가를 확인하고 있습니다.</p> : taskPreview.items.length ? <>
            {!visibleTodos.length && <p className="notification-popover-state">선택한 종류의 할 일이 없습니다.</p>}
            <div className="header-task-preview-cards" aria-label="할 일 전체 목록">{visibleTodos.map((item) => {
              const isEvaluation = item.type === 'PEER_EVALUATION';
              const task = item.task;
              const label = isEvaluation ? (item.evaluation.roundType === 'MID' ? '중간 동료 평가' : '최종 동료 평가') : (statusLabels[task.status] || task.status);
              return <button type="button" className="header-task-preview-card" data-status={task?.status || 'EVALUATION'} data-type={item.type} key={`${item.type}-${item.id}`} onClick={() => openTodo(item)}>
              <div className="header-task-preview-card-heading"><span className="header-task-preview-status"><i />{label}</span><small className="todo-type-label">{isEvaluation ? '동료 평가' : '작업'}</small>{item.isOverdue && <span className="header-task-preview-overdue">마감 지남</span>}</div>
              <strong>{item.title}</strong>
              <span className="header-task-preview-meta">{item.teamName} · 마감 {formatDate(item.dueAt)}</span>
            </button>})}</div>
          </> : <p className="notification-popover-state">현재 할 일이나 진행 중인 동료 평가가 없습니다.</p>}
        </section>}
      </div>
      {open && <section className="notification-popover" aria-label="최근 알림">
        <header className="notification-popover-heading"><strong>{count.error ? '알림' : `읽지 않은 알림 ${count.data ?? 0}개`}</strong><button type="button" onClick={() => { setOpen(false); navigate('/notifications'); }}>전체 보기</button></header>
        {count.error && <p className="notification-popover-state" role="alert">읽지 않은 알림 수를 불러오지 못했습니다.</p>}
        {recent.error ? <p className="notification-popover-state">알림을 불러오지 못했습니다.</p> : recent.loading && !recent.data ? <p className="notification-popover-state" role="status">알림을 불러오는 중…</p> : recent.data?.items.length ? <>
          <div className="header-notification-preview-cards">{recent.data.items.slice(0, 3).map((item) => <button type="button" className="header-notification-preview-card" data-unread={!item.readAt} key={item.id} onClick={() => openNotification(item)}>
            <span className="header-notification-preview-card-heading"><span className="header-notification-preview-state"><i />{item.readAt ? '읽음' : '읽지 않음'}</span><time>{formatDate(item.createdAt)}</time></span>
            <strong>{item.title}</strong>
            {item.message && <span className="header-notification-preview-message">{item.message}</span>}
          </button>)}</div>
        </> : <p className="notification-popover-state">최근 알림이 없습니다.</p>}
        <button type="button" className="notification-popover-all" onClick={() => { setOpen(false); navigate('/notifications'); }}><CheckCheck size={16} /> 알림함 열기</button>
      </section>}
    </div>
  );
}
