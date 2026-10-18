import { useState } from 'react';
import { useSearchParams } from 'react-router';
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
  const [evaluationRevision, setEvaluationRevision] = useState(0);
  return (
    <section className="stack member-contributions-page">
      <button className="secondary-button back-button" onClick={onBack}>
        ← 대시보드로
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">관리자 읽기 전용</span>
          <h1>{member?.name || '팀원'}님의 수행 상세</h1>
          <p>{context.team.name} · 현재 담당 작업과 최신 자료를 확인합니다.</p>
        </div>
        <button
          className="secondary-button"
          disabled={resource.loading}
          onClick={() => {
            resource.reload();
            setEvaluationRevision((revision) => revision + 1);
          }}
        >
          수행 상세 새로고침
        </button>
      </div>
      {!resource.error && resource.data && (
        <section className="member-work-summary">
          <h2>담당 작업 요약</h2>
          <div className="action-summary">
            {Object.entries(statusLabels).map(([status, label]) => (
              <div key={status}>
                {label}{' '}
                <strong>
                  {
                    resource.data.filter((task) => task.status === status)
                      .length
                  }
                  건
                </strong>
              </div>
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
              <section className="member-task-record" key={task.taskId}>
                <div className="page-heading">
                  <h2>{task.title}</h2>
                  <span
                    className={`status-badge task-state-${task.status.toLowerCase()}`}
                  >
                    {statusLabels[task.status]}
                  </span>
                </div>
                <dl className="member-task-metadata">
                  <div>
                    <dt>예상 작업량</dt>
                    <dd>{formatExpectedWorkload(task.weight)}</dd>
                  </div>
                  <div>
                    <dt>본인 배분</dt>
                    <dd>{task.allocationPercent}%</dd>
                  </div>
                  <div>
                    <dt>시작일</dt>
                    <dd>{formatDate(task.startAt)}</dd>
                  </div>
                  <div>
                    <dt>마감</dt>
                    <dd>{formatDate(task.dueAt)}</dd>
                  </div>
                </dl>
                <div className="member-task-materials">
                  <div className="member-task-description">
                    <h3>본인이 작성한 수행 설명</h3>
                    <p className="preserve-lines">
                      {task.contributionDescription ||
                        '아직 작성하지 않았습니다. 미작성만으로 수행 여부를 판단할 수 없습니다.'}
                    </p>
                    <p className="field-help">
                      수행 설명 수정 {formatDate(task.contributionUpdatedAt)}
                    </p>
                  </div>
                  <div className="member-task-deliverables">
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
                      <p className="field-help">연결된 산출물이 없습니다.</p>
                    )}
                  </div>
                </div>
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
      <MemberEvaluationResults
        spaceId={context.space.id}
        teamId={context.team.id}
        targetUserId={targetUserId}
        revision={evaluationRevision}
      />
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
            <MarkdownBody>{item.text ?? item.textOrUrl}</MarkdownBody>
          )}
        </>
      )}
    </ResourceState>
  );
}
