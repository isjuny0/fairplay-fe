import { koreanDateTime } from '../lib/koreanTime.js';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import {
  Check,
  LayoutDashboard,
  Plus,
  Settings2,
} from 'lucide-react';
import Icon from './Icon.jsx';
import TeamBriefingCard from './team-briefing/TeamBriefingCard.jsx';
import DashboardWidgetFrame from './DashboardWidgetFrame.jsx';
import DashboardWidgetCatalogItem from './DashboardWidgetCatalogItem.jsx';
import TeamDashboardWidget from './TeamDashboardWidget.jsx';
import DashboardWidgetPreview from './DashboardWidgetPreview.jsx';
import useMobileLayout from '../hooks/useMobileLayout.js';
import { getHomePreferences, updateHomePreferences } from '../api/teamHome.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { getTeamReport } from '../api/reports.js';
import '../team-dashboard.css';
import '../dashboard-layout.css';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { getMyWorkSummary } from '../api/teams.js';
import { listTasks } from '../api/tasks.js';
import { toDateInput } from '../lib/domain.js';
import { dashboardWidgets } from '../lib/teamDashboard.js';
import { isPreviewPath } from '../lib/previewPath.js';
import { teamMenuPath } from '../lib/routes.js';
import { ErrorNotice, Modal, ResourceState } from './ui.jsx';

export default function TeamHome(props) {
  const { pathname } = useLocation();
  const { space, team, user } = props.context;
  const scopeKey = `${isPreviewPath(pathname)}:${space.id}:${team.id}:${user.id}`;
  return <TeamHomePreferences key={scopeKey} {...props} />;
}

function TeamHomePreferences(props) {
  const { team, user } = props.context;
  const resource = useResource(
    () => getHomePreferences(team.id),
    [team.id, user.id],
  );
  const summaryResource = useResource(
    () => getMyWorkSummary(team.id),
    [team.id, user.id],
  );
  return (
    <ResourceState resource={resource} label="팀 홈 설정">
      {resource.data && (
        <TeamDashboard
          {...props}
          initialPreferences={resource.data}
          summaryResource={summaryResource}
        />
      )}
    </ResourceState>
  );
}


function TeamDashboard({
  context,
  onNavigate,
  initialPreferences,
  summaryResource,
}) {
  const [dashboard, setDashboard] = useState(initialPreferences);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { confirm } = useInteractions();
  const [memoDirty, setMemoDirty] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const [catalogPreview, setCatalogPreview] = useState(null);
  const catalogMobile = useMobileLayout('(max-width: 1000px)');
  const [editing, setEditing] = useState(false);
  const widgetGrid = useRef(null);
  const [highlightedWidgets, setHighlightedWidgets] = useState([]);
  const [pendingWidget, setPendingWidget] = useState(null);
  const catalogAdditions = useRef([]);
  const openCatalog = () => {
    catalogAdditions.current = [];
    setCatalogPreview(null);
    setHighlightedWidgets([]);
    setCatalog(true);
  };
  const finishCatalog = () => {
    const additions = catalogAdditions.current.filter(id => dashboard.widgets.includes(id));
    setCatalog(false);
    setEditing(true);
    setHighlightedWidgets(additions);
    setPendingWidget(additions.at(-1) || null);
  };
  useEffect(() => {
    if (catalog || !pendingWidget) return;
    const frame = requestAnimationFrame(() => {
      const widget = [...(widgetGrid.current?.children || [])]
        .find(element => element.dataset.widgetId === pendingWidget);
      widget?.querySelector('.dashboard-drag-handle')?.focus({ preventScroll: true });
      widget?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
      setPendingWidget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [catalog, pendingWidget]);
  useEffect(() => {
    if (!highlightedWidgets.length) return;
    const timer = setTimeout(() => setHighlightedWidgets([]), 3000);
    return () => clearTimeout(timer);
  }, [highlightedWidgets]);
  const [draggedId, setDraggedId] = useState(null);
  const [dropId, setDropId] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [now, setNow] = useState(Date.now());
  const navigate = useAppNavigate();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = toDateInput(koreanDateTime(now)).slice(0, 10);
  const save = async (patch) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateHomePreferences(context.team.id, patch);
      setDashboard(saved);
      return true;
    } catch (error) {
      setSaveError(error);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const reportResource = useResource(async () => {
    if (!dashboard.widgets.includes('contribution')) return null;
    try {
      return await getTeamReport(context.team.id);
    } catch (error) {
      if (
        error.status === 404 &&
        ['REPORT_NOT_FOUND', 'NOT_FOUND'].includes(error.code)
      )
        return null;
      throw error;
    }
  }, [
    context.team.id,
    context.user.id,
    dashboard.widgets.includes('contribution'),
  ]);
  const needsTasks = dashboard.widgets.some((id) =>
    ['attention', 'upcoming', 'status'].includes(id),
  );
  const taskResource = useResource(
    () => (needsTasks ? listTasks(context.team.id) : Promise.resolve([])),
    [context.team.id, context.user.id, needsTasks],
  );
  const move = (index, direction) => {
    const widgets = [...dashboard.widgets];
    [widgets[index], widgets[index + direction]] = [
      widgets[index + direction],
      widgets[index],
    ];
    save({ widgets });
  };
  const removeWidget = async (id) => {
    if (savingRef.current || !dashboard.widgets.includes(id)) return;
    if (id === 'memo' && memoDirty && !(await confirm({
      title: '저장하지 않은 메모',
      message: '메모를 저장하지 않았습니다. 입력 내용을 버리고 위젯을 제거할까요?',
      label: '위젯 제거',
    }))) return;
    if (await save({ widgets: dashboard.widgets.filter(item => item !== id) })) {
      if (id === 'memo') setMemoDirty(false);
      setAnnouncement(`${dashboardWidgets.find(widget => widget.id === id).title} 위젯을 제거했습니다.`);
    }
  };
  const taskLink = (task) =>
    navigate(
      `${teamMenuPath(context.space.id, context.team.id, '작업')}/${task.id}`,
    );
  const finishDrag = (id) => {
    setDraggedId(id);
    if (!id) setDropId(null);
  };
  const dropWidget = async (source, target) => {
    setDraggedId(null);
    setDropId(null);
    const from = dashboard.widgets.indexOf(source),
      to = dashboard.widgets.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    const widgets = [...dashboard.widgets];
    widgets.splice(from, 1);
    widgets.splice(to, 0, source);
    if (!(await save({ widgets }))) return;
    setAnnouncement(
      dashboardWidgets.find((widget) => widget.id === source).title +
        ' 위젯을 ' +
        (to + 1) +
        '번째로 이동했습니다.',
    );
  };

  return (
    <section className="team-dashboard">
      <header className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">
            <LayoutDashboard size={14} />팀 홈
          </span>
          <h1>{context.team.name}</h1>
        </div>
        <div className="dashboard-heading-actions">
          <button
            className="secondary-button"
            onClick={() => onNavigate('팀 자료 검색')}
          >
            <Icon name="search" />자료에 질문하기
          </button>
          <button
            type="button"
            className={`secondary-button dashboard-edit-toggle ${editing ? 'is-active' : ''}`}
            onClick={() => setEditing(!editing)}
            aria-pressed={editing}
            disabled={saving}
          >
            {editing ? <Check size={15} /> : <Settings2 size={15} />}
            {editing ? '편집 완료' : '위젯 편집'}
          </button>
        </div>
      </header>
      <TeamBriefingCard spaceId={context.space.id} teamId={context.team.id} userId={context.user.id} />
      {!catalog && <ErrorNotice error={saveError} />}
      {saving && (
        <p role="status" className="field-help">
          개인 홈 설정을 저장하는 중…
        </p>
      )}
      {editing && (
        <p className="dashboard-edit-hint" role="status">
          <Settings2 size={15} />
          손잡이를 끌거나 화살표를 눌러 순서를 바꾸세요. 모든 위젯을 이동·제거할
          수 있어요.
        </p>
      )}
      <span className="sr-only" role="status">
        {announcement}
      </span>
      <div className="dashboard-widget-grid dashboard-arrange-grid" ref={widgetGrid}>
        {dashboard.widgets.map((id, index) => {
          const widget = dashboardWidgets.find((item) => item.id === id);
          return (
            <DashboardWidgetFrame
              key={id}
              widget={widget}
              index={index}
              count={dashboard.widgets.length}
              editing={editing}
              highlighted={highlightedWidgets.includes(id)}
              disabled={saving}
              draggedId={draggedId}
              dropId={dropId}
              onDrag={finishDrag}
              onTarget={setDropId}
              onDrop={dropWidget}
              onMove={move}
              onRemove={removeWidget}
            >
              <TeamDashboardWidget
                id={id} context={context} summaryResource={summaryResource}
                taskResource={taskResource} reportResource={reportResource}
                today={today} now={now} needsTasks={needsTasks}
                onNavigate={onNavigate} taskLink={taskLink} onRefreshTime={setNow}
                memo={dashboard.memo} onSaveMemo={save} saving={saving} onMemoDirty={setMemoDirty}
              />
            </DashboardWidgetFrame>
          );
        })}
      </div>
      {editing && <button
        type="button"
        className="dashboard-add-placeholder"
        disabled={saving}
        onClick={openCatalog}
      >
        <Plus size={18} />
        <strong>필요한 위젯 추가하기</strong>
      </button>}
      {catalog && (
        <Modal title="위젯 추가" className="dashboard-catalog-modal" onClose={() => setCatalog(false)} busy={saving} restoreFocusWithoutScroll wide>
          <ErrorNotice error={saveError} />
          <div className="dashboard-catalog-layout" onKeyDownCapture={event => {
            if (event.key === 'Escape' && catalogPreview) {
              event.preventDefault(); event.stopPropagation(); setCatalogPreview(null);
            }
          }}>
          <div className="dashboard-catalog">
            {dashboardWidgets.map((widget) => {
              const added = dashboard.widgets.includes(widget.id);
              return (
                <DashboardWidgetCatalogItem
                  key={widget.id}
                  widget={widget}
                  added={added}
                  disabled={saving}
                  preview={catalogPreview}
                  onPreview={setCatalogPreview}
                  mobile={catalogMobile}
                  onToggle={async () => {
                    if (added) {
                      await removeWidget(widget.id);
                    } else if (await save({ widgets: [...dashboard.widgets, widget.id] })) {
                      catalogAdditions.current = [...catalogAdditions.current.filter(id => id !== widget.id), widget.id];
                    }
                  }}
                />
              );
            })}
          </div>
          {!catalogMobile && <aside className="dashboard-catalog-preview-panel" aria-label="위젯 미리보기 영역">
            {catalogPreview ? <DashboardWidgetPreview widget={dashboardWidgets.find(widget => widget.id === catalogPreview)} /> : <p className="dashboard-preview-empty">항목에 마우스를 올려 미리보기를 확인하세요.</p>}
          </aside>}
          </div>
          <p className="dashboard-settings-note">
            일정은 팀원 모두와 공유됩니다. 위젯 구성과 메모는 내 계정에만 저장됩니다.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={finishCatalog}
            >
              완료
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
