import { useId, useState } from 'react';
import SectionTabs from './SectionTabs.jsx';
import '../member-contributions.css';
import RefreshButton from './RefreshButton.jsx';
import { useLocation, useSearchParams } from 'react-router';
import { ErrorNotice } from './ui.jsx';
import { getMemberContributions } from '../api/dashboard.js';
import { listDeliverables, downloadDeliverable } from '../api/deliverables.js';
import { ApiError } from '../api/client.js';
import useResource from '../hooks/useResource.js';
import {
  formatDate,
  formatExpectedWorkload,
  statusLabels,
} from '../lib/domain.js';
import MemberEvaluationResults from './MemberEvaluationResults.jsx';
import MarkdownBody from './MarkdownBody.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

const detailTabs = [['work', '작업 기록'], ['evaluations', '동료 평가 결과']];

export default function MemberContributions({ context, targetUserId, onBack, members }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const tabsId = useId();
  const activeTab = params.get('tab') === 'evaluations' ? 'evaluations' : 'work';
  const statusFilter = Object.hasOwn(statusLabels, params.get('status')) ? params.get('status') : 'ALL';
  const member = members.data?.find((entry) => entry.userId === targetUserId);
  const resource = useResource(() => getMemberContributions(context.team.id, targetUserId), [context.team.id, targetUserId]);
  const [evaluationRevision, setEvaluationRevision] = useState(0);
  const tasks = resource.data || [];
  const filteredTasks = tasks.filter((task) => statusFilter === 'ALL' || task.status === statusFilter);
  const selectedTask = filteredTasks.find((task) => String(task.taskId) === params.get('taskId')) || filteredTasks[0];
  const updateQuery = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => value == null ? next.delete(key) : next.set(key, value));
    setParams(next, { replace: true, preventScrollReset: true, state: location.state });
  };
  return (
    <section className="stack member-contributions-page">
      <button className="ghost-button back-button" onClick={onBack}>← 팀 관리</button>
      <div className="page-heading">
        <div><h1>{member?.name || '팀원'}님의 수행 상세</h1></div>
        <RefreshButton label="수행 상세 새로고침" disabled={resource.loading}
          onClick={() => { resource.reload(); members.reload(); setEvaluationRevision((revision) => revision + 1); }} />
      </div>
      <ResourceState resource={members} label="팀원 정보" />
      <SectionTabs id={tabsId} label="수행 상세 보기" tabs={detailTabs} activeTab={activeTab}
        onSelect={(key) => updateQuery({ tab: key === 'work' ? null : key })} />
      <div role="tabpanel" id={`${tabsId}-work-panel`} aria-labelledby={`${tabsId}-work-tab`} hidden={activeTab !== 'work'}>
        {activeTab === 'work' && <>
          {!resource.error && resource.data && <div className="member-record-toolbar">
            <div className="member-record-summary" aria-label="담당 작업 요약">
              <strong>담당 작업 {tasks.length}건</strong>
              <dl>{Object.entries(statusLabels).map(([status, label]) => <div key={status}><dt>{label}</dt><dd>{tasks.filter((task) => task.status === status).length}</dd></div>)}</dl>
            </div>
            <label className="form-field"><span className="field-label">조회할 작업 상태</span>
              <select aria-label="조회할 작업 상태" value={statusFilter} onChange={(event) => updateQuery({ status: event.target.value === 'ALL' ? null : event.target.value, taskId: null })}>
                <option value="ALL">전체 작업</option>
                {Object.entries(statusLabels).map(([status, label]) => <option value={status} key={status}>{label}</option>)}
              </select>
            </label>
          </div>}
          <ResourceState resource={resource}>
            {resource.data && (tasks.length ? (filteredTasks.length ? <div className="member-record-layout">
              <nav className="member-record-list" aria-label="담당 작업 목록">
                {filteredTasks.map((task) => <button type="button" key={task.taskId} aria-current={task.taskId === selectedTask?.taskId ? 'true' : undefined}
                  onClick={() => updateQuery({ taskId: String(task.taskId) })}>
                  <span className={`status-badge task-state-${task.status.toLowerCase()}`}>{statusLabels[task.status]}</span>
                  <strong>{task.title}</strong>
                  <small>마감 {formatDate(task.dueAt)}</small>
                </button>)}
              </nav>
              {selectedTask && <MemberTaskRecord key={`${selectedTask.taskId}:${selectedTask.taskVersion}`} task={selectedTask} teamId={context.team.id} />}
            </div> : <EmptyState>선택한 상태의 담당 작업이 없습니다.</EmptyState>) : <EmptyState>현재 담당 작업이 없습니다.</EmptyState>)}
          </ResourceState>
        </>}
      </div>
      <div role="tabpanel" id={`${tabsId}-evaluations-panel`} aria-labelledby={`${tabsId}-evaluations-tab`} hidden={activeTab !== 'evaluations'}>
        {activeTab === 'evaluations' && <MemberEvaluationResults spaceId={context.space.id} teamId={context.team.id} targetUserId={targetUserId} revision={evaluationRevision} />}
      </div>
    </section>
  );
}

function MemberTaskRecord({ task, teamId }) {
  return <section className="member-task-record" aria-label="선택한 작업 기록">
    <div className="member-record-heading"><span className={`status-badge task-state-${task.status.toLowerCase()}`}>{statusLabels[task.status]}</span><h2>{task.title}</h2></div>
    <dl className="member-task-metadata">
      <div><dt>시작일</dt><dd>{formatDate(task.startAt)}</dd></div>
      <div><dt>마감</dt><dd>{formatDate(task.dueAt)}</dd></div>
      <div><dt>예상 작업량</dt><dd>{formatExpectedWorkload(task.weight)}</dd></div>
      <div><dt>본인 배분</dt><dd>{task.allocationPercent}%</dd></div>
    </dl>
    <div className="member-task-materials">
      <section className="member-task-description"><div className="section-heading"><h3>수행 설명</h3>
        {task.contributionUpdatedAt && <small>수정 {formatDate(task.contributionUpdatedAt)}</small>}</div>
        <p className="preserve-lines">{task.contributionDescription || '아직 작성하지 않았습니다. 미작성만으로 수행 여부를 판단할 수 없습니다.'}</p>
      </section>
      <section className="member-task-deliverables"><div className="section-heading"><h3>연결된 최신 산출물</h3><span>{task.deliverableSummary.length}개</span></div>
        {task.deliverableSummary.length ? task.deliverableSummary.map((item) => <LinkedDeliverable key={`${item.id}:${item.version}:${task.taskVersion}`} item={item} teamId={teamId} taskId={task.taskId} />)
          : <p className="field-help">연결된 산출물이 없습니다.</p>}
      </section>
    </div>
  </section>;
}

function LinkedDeliverable({ item, teamId, taskId }) {
  const [opened, setOpened] = useState(false);
  return (
    <details
      className="read-only-deliverable"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary>
        {item.title} · {{ TEXT: '문서', FILE: '파일', URL: '링크' }[item.type]}
      </summary>
      {opened && (
        <DeliverableContent
          teamId={teamId}
          taskId={taskId}
          deliverableId={item.id}
          summaryVersion={item.version}
        />
      )}
    </details>
  );
}

function DeliverableContent({ teamId, taskId, deliverableId, summaryVersion }) {
  const resource = useResource(async () => {
    // 목록 API의 페이지 한도를 지키면서 요약에 연결된 산출물의 현재 본문을 찾는다.
    for (let page = 0; ; page++) {
      const items = await listDeliverables(teamId, { taskId, page, size: 100 });
      const item = items.find((item) => item.id === deliverableId);
      if (item) return item;
      if (items.length < 100)
        throw new ApiError(404, {
          code: 'DELIVERABLE_NOT_FOUND',
          message:
            '산출물이 삭제되었거나 연결이 변경되었습니다. 수행 상세를 다시 불러와 주세요.',
        });
    }
  }, [teamId, taskId, deliverableId]);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const item = resource.data;
  const download = async () => {
    setBusy(true);
    setDownloadError(null);
    try {
      const blob = await downloadDeliverable(deliverableId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.file.originalFilename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResourceState resource={resource}>
      {item && (
        <>
          {item.version !== summaryVersion && (
            <p className="notice">요약 조회 이후 변경된 최신 산출물입니다.</p>
          )}
          <h4 className="sr-only">{item.title}</h4>
          {item.description && (
            <p className="preserve-lines">{item.description}</p>
          )}
          {item.type === 'FILE' ? (
            <>
              <p>{item.file.originalFilename}</p>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={download}
              >
                {busy ? '다운로드 중…' : '파일 다운로드'}
              </button>
              <ErrorNotice error={downloadError} />
            </>
          ) : (
            <MarkdownBody>{item.text ?? item.textOrUrl}</MarkdownBody>
          )}
        </>
      )}
    </ResourceState>
  );
}
