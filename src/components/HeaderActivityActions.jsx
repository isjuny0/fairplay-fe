import { useEffect, useRef, useState } from 'react';
import { Bell, ListTodo, CheckCheck } from 'lucide-react';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { getMyNotificationUnreadCount, listMyNotifications, markNotificationRead } from '../api/personalWork.js';
import { announceNotificationChange, notificationPath } from '../lib/personalWork.js';

export default function HeaderActivityActions() {
  const navigate = useAppNavigate();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(false);
  const root = useRef(null);
  const count = useResource(getMyNotificationUnreadCount, []);
  const recent = useResource(() => listMyNotifications({ filter: 'ALL', accessibleOnly: true, size: 5 }), []);

  useEffect(() => {
    const update = () => { count.reload(); recent.reload(); };
    window.addEventListener('fairplay:notifications-changed', update);
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const key = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('fairplay:notifications-changed', update);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
    };
  }, [count.reload, recent.reload]);

  const openNotification = async (item) => {
    try {
      if (!item.readAt) {
        setBusyId(item.id);
        await markNotificationRead(item.id);
        setActionError(false);
        announceNotificationChange();
      }
      const path = notificationPath(item);
      setOpen(false);
      navigate(path || '/notifications');
    } catch {
      setActionError(true);
      count.reload();
      recent.reload();
    } finally { setBusyId(null); }
  };

  return (
    <div className="header-activity-actions" ref={root}>
      <button className="header-activity-button" type="button" aria-label="알림함" title="알림함" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Bell size={19} />
        {count.data > 0 && <span className="notification-count">{count.data > 99 ? '99+' : count.data}</span>}
      </button>
      <button className="header-activity-button" type="button" aria-label="할 일" title="할 일" onClick={() => navigate('/my/tasks')}>
        <ListTodo size={19} />
      </button>
      {open && <section className="notification-popover" aria-label="최근 알림">
        <header className="notification-popover-heading"><strong>알림</strong><button type="button" onClick={() => { setOpen(false); navigate('/notifications'); }}>전체 보기</button></header>
        {actionError && <p className="notification-popover-state" role="alert">읽음 처리에 실패했습니다. 다시 시도해 주세요.</p>}
        {count.error && <p className="notification-popover-state" role="alert">읽지 않은 알림 수를 불러오지 못했습니다.</p>}
        {recent.error ? <p className="notification-popover-state">알림을 불러오지 못했습니다.</p> : recent.loading && !recent.data ? <p className="notification-popover-state" role="status">알림을 불러오는 중…</p> : recent.data?.items.length ? <ul>
          {recent.data.items.map((item) => <li key={item.id}>
            <button type="button" className={`notification-preview ${item.readAt ? '' : 'is-unread'}`} disabled={busyId === item.id} onClick={() => openNotification(item)}>
              <span className="notification-preview-title">{item.title}</span>
              {item.message && <span className="notification-preview-message">{item.message}</span>}
              <time>{new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date(item.createdAt))}</time>
            </button>
          </li>)}
        </ul> : <p className="notification-popover-state">최근 알림이 없습니다.</p>}
        <button type="button" className="notification-popover-all" onClick={() => { setOpen(false); navigate('/notifications'); }}><CheckCheck size={16} /> 알림함 열기</button>
      </section>}
    </div>
  );
}
