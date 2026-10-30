import { useContext, useEffect, useState } from 'react';
import { Check, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { getMyNotificationUnreadCount, listMyNotifications, markAllNotificationsRead, markNotificationRead } from '../api/personalWork.js';
import { announceNotificationChange, notificationPath, notificationTypeLabels } from '../lib/personalWork.js';
import { formatDate } from '../lib/domain.js';
import { pageNumbers } from '../lib/pageNumbers.js';
import { ErrorNotice, EmptyState, ResourceState } from './ui.jsx';
import { HeaderContext } from './HeaderContext.js';
import PersonalWorkBackButton from './PersonalWorkBackButton.jsx';

const PAGE_SIZE = 20;

export default function PersonalNotifications() {
  const navigate = useAppNavigate();
  const setHeaderContext = useContext(HeaderContext);
  const { pathname } = useLocation();
  const [filter, setFilter] = useState('ALL');
  const [cursors, setCursors] = useState([null]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const cursor = cursors.at(-1);
  const resource = useResource(() => listMyNotifications({ filter, size: PAGE_SIZE, cursor }), [filter, cursor]);
  const unreadCount = useResource(getMyNotificationUnreadCount, []);

  useEffect(() => {
    setHeaderContext?.({ pathname, scope: '개인 업무', title: '알림함', detail: '내 알림' });
  }, [setHeaderContext, pathname]);

  const changeFilter = (value) => { setCursors([null]); setFilter(value); };

  const markOne = async (item) => {
    setBusy(true);
    try {
      await markNotificationRead(item.id);
      setActionError(null);
      announceNotificationChange();
      resource.reload();
      unreadCount.reload();
    } catch (error) { setActionError(error); }
    finally { setBusy(false); }
  };
  const markAll = async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setActionError(null);
      announceNotificationChange();
      resource.reload();
      unreadCount.reload();
    } catch (error) { setActionError(error); }
    finally { setBusy(false); }
  };

  const openNotification = async (item, targetPath) => {
    if (!targetPath) return;
    if (!item.readAt) {
      setBusy(true);
      try {
        await markNotificationRead(item.id);
        setActionError(null);
        announceNotificationChange();
        unreadCount.reload();
      } catch (error) {
        setActionError(error);
        return;
      } finally { setBusy(false); }
    }
    navigate(targetPath);
  };

  const page = resource.data;
  const visibleNotificationPages = pageNumbers(
    cursors.length,
    cursors.length + (page?.nextCursor ? 1 : 0),
    window.matchMedia('(max-width: 600px)').matches ? 7 : 10,
  );
  const selectNotificationPage = (pageNumber) => {
    if (pageNumber <= cursors.length) {
      setCursors((items) => items.slice(0, pageNumber));
    } else if (pageNumber === cursors.length + 1 && page?.nextCursor) {
      setCursors((items) => [...items, page.nextCursor]);
    }
  };
  return <main className="main-content personal-work-page">
    <header className="page-heading">
      <div className="personal-work-heading-group"><PersonalWorkBackButton /><div><h1>알림함</h1><p>내게 도착한 알림을 확인하고 읽음으로 표시합니다.</p></div></div>
      <button type="button" className="secondary-button" disabled={busy || !(unreadCount.data > 0)} onClick={markAll}><CheckCheck size={17} /> 모두 읽음</button>
    </header>
    <nav className="personal-work-tabs" aria-label="알림 필터">
      <button type="button" aria-pressed={filter === 'ALL'} className={filter === 'ALL' ? 'active' : ''} onClick={() => changeFilter('ALL')}>전체</button>
      <button type="button" aria-pressed={filter === 'UNREAD'} className={filter === 'UNREAD' ? 'active' : ''} onClick={() => changeFilter('UNREAD')}>읽지 않음</button>
    </nav>
    <ResourceState resource={resource} label="알림">
      {page?.items.length ? <ul className="personal-notification-list">
        {page.items.map((item) => {
          const targetPath = notificationPath(item);
          const copy = <span className="personal-notification-copy">
              <span className="personal-notification-title-row">
                <strong>{item.title}</strong>
                {item.type && <span className="notification-type-label">{notificationTypeLabels[item.type] || item.type}</span>}
                {!item.readAt && <span className="notification-unread-label">읽지 않음</span>}
              </span>
              {item.message && <span className="personal-notification-message">{item.message}</span>}
              <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
            </span>;
          return <li key={item.id} className={`personal-notification ${!item.readAt ? 'is-unread' : ''} ${!item.accessible ? 'is-inaccessible' : ''}`}>
            {targetPath
              ? <button type="button" className="personal-notification-open" disabled={busy} aria-label={`${item.title} 상세 보기`} onClick={() => openNotification(item, targetPath)}>{copy}</button>
              : copy}
            {!item.readAt && <button
              type="button"
              className="notification-mark-read"
              aria-label={`${item.title} 읽음으로 표시`}
              title="읽음으로 표시"
              disabled={busy}
              onClick={() => markOne(item)}
            ><Check size={17} /></button>}
          </li>;
        })}
      </ul> : <EmptyState>{filter === 'UNREAD' ? '읽지 않은 알림이 없습니다.' : '표시할 알림이 없습니다.'}</EmptyState>}
    </ResourceState>
    {actionError && <ErrorNotice error={actionError} onRetry={() => setActionError(null)} />}
    {!resource.error && page && <nav className="personal-work-pagination" aria-label="알림 페이지">
      <button type="button" className="personal-work-page-arrow" aria-label="이전 페이지" disabled={cursors.length <= 1 || resource.loading} onClick={() => setCursors((items) => items.slice(0, -1))}><ChevronLeft size={20} /></button>
      <div className="personal-work-page-numbers">{visibleNotificationPages.map((number) => <button
        type="button"
        className="personal-work-page-number"
        aria-label={`알림 ${number}페이지`}
        aria-current={number === cursors.length ? 'page' : undefined}
        key={number}
        disabled={resource.loading}
        onClick={() => selectNotificationPage(number)}
      >{number}</button>)}</div>
      <button type="button" className="personal-work-page-arrow" aria-label="다음 페이지" disabled={!page.nextCursor || resource.loading} onClick={() => setCursors((items) => [...items, page.nextCursor])}><ChevronRight size={20} /></button>
    </nav>}
  </main>;
}
