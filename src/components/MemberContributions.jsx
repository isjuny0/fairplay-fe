import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ErrorNotice } from './ui.jsx';
import { getMemberContributions } from '../api/dashboard.js';
import { getMidFeedback } from '../api/evaluations.js';
import { listDeliverables, downloadDeliverable } from '../api/deliverables.js';
import { ApiError } from '../api/client.js';
import useResource from '../hooks/useResource.js';
import {
  formatDate,
  formatExpectedWorkload,
  statusLabels,
} from '../lib/domain.js';
import { FeedbackCards } from './PlanningUi.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

export default function MemberContributions({ context, targetUserId, onBack }) {
  const [params, setParams] = useSearchParams();
  const statusFilter = Object.hasOwn(statusLabels, params.get('status'))
    ? params.get('status')
    : 'ALL';
  const member = context.members.find(
    (member) => member.userId === targetUserId,
  );
  const resource = useResource(
    () => getMemberContributions(context.team.id, targetUserId),
    [context.team.id, targetUserId],
  );
  const feedback = useResource(
    () => getMidFeedback(context.team.id),
    [context.team.id, targetUserId],
  );
  const ownFeedback = feedback.data?.members.find(
    (member) => member.userId === targetUserId,
  );
  return (
    <section className="stack">
      <button className="secondary-button back-button" onClick={onBack}>
        ← 대시보드로
      </button>
      <button
        className="secondary-button"
        onClick={() => {
          resource.reload();
          feedback.reload();
        }}
      >
        수행 상세 새로고침
      </button>
      <div>
        <span className="eyebrow">관리자 읽기 전용</span>
        <h1>{member?.name || '팀원'}님의 수행 상세</h1>
        <p>{context.team.name} · 현재 담당 작업과 최신 자료를 확인합니다.</p>
      </div>
      {!resource.error && resource.data && (
        <section className="panel">
          <h2>담당 작업 요약</h2>
          <div className="action-summary">
            {Object.entries(statusLabels).map(([status, label]) => (
              <span key={status}>
                {label}{' '}
                <strong>
                  {
                    resource.data.filter((task) => task.status === status)
                      .length
                  }
                  건
                </strong>
              </span>
            ))}
          </div>
          <label className="form-field">
            <span className="field-label">조회할 작업 상태</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setParams(
                  event.target.value === 'ALL'
                    ? {}
                    : { status: event.target.value },
                )
              }
            >
              <option value="ALL">전체 작업</option>
              {Object.entries(statusLabels).map(([status, label]) => (
                <option value={status} key={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      <ResourceState resource={resource}>
        {resource.data?.length ? (
          resource.data
            .filter(
              (task) => statusFilter === 'ALL' || task.status === statusFilter,
            )
            .map((task) => (
              <section className="panel" key={task.taskId}>
                <div className="page-heading">
                  <h2>{task.title}</h2>
                  <span
                    className={`status-badge task-state-${task.status.toLowerCase()}`}
                  >
                    {statusLabels[task.status]}
                  </span>
                </div>
                <p>
                  예상 작업량: {formatExpectedWorkload(task.weight)} · 본인 배분{' '}
                  {task.allocationPercent}% · 마감 {formatDate(task.dueAt)}
                </p>
                <h3>본인이 작성한 수행 설명</h3>
                <p className="preserve-lines">
                  {task.contributionDescription ||
                    '아직 작성하지 않았습니다. 미작성만으로 수행 여부를 판단할 수 없습니다.'}
                </p>
                <p className="field-help">
                  수행 설명 수정 {formatDate(task.contributionUpdatedAt)}
                </p>
                <h3>연결된 최신 산출물</h3>
                {task.deliverableSummary.length ? (
                  task.deliverableSummary.map((item) => (
                    <LinkedDeliverable
                      key={`${item.id}:${item.version}:${task.taskVersion}`}
                      item={item}
                      teamId={context.team.id}
                      taskId={task.taskId}
                    />
                  ))
                ) : (
                  <p>연결된 산출물이 없습니다.</p>
                )}
              </section>
            ))
        ) : (
          <EmptyState>현재 담당 작업이 없습니다.</EmptyState>
        )}
      </ResourceState>
      {resource.data?.length > 0 &&
        !resource.data.some(
          (task) => statusFilter === 'ALL' || task.status === statusFilter,
        ) && <EmptyState>선택한 상태의 담당 작업이 없습니다.</EmptyState>}
      {feedback.error &&
      !['MID_FEEDBACK_NOT_READY', 'ROUND_NOT_FOUND'].includes(
        feedback.error.code,
      ) ? (
        <ErrorNotice error={feedback.error} onRetry={feedback.reload} />
      ) : ownFeedback ? (
        <>
          <h2>중간 평가 협업 평균과 개선 안내</h2>
          <FeedbackCards member={ownFeedback} />
        </>
      ) : (
        <section className="panel">
          <h2>중간 피드백</h2>
          <p>{feedback.error?.message || '피드백을 준비하고 있습니다.'}</p>
        </section>
      )}
    </section>
  );
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
          <h4>{item.title}</h4>
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
            <p className="preserve-lines">{item.text ?? item.textOrUrl}</p>
          )}
        </>
      )}
    </ResourceState>
  );
}
