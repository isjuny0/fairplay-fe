import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ErrorNotice } from './ui.jsx';
import { requestPlanned, getMidFeedback } from '../api/planned.js';
import useResource from '../hooks/useResource.js';
import {
  formatDate,
  formatExpectedWorkload,
  statusLabels,
} from '../lib/domain.js';
import { FeedbackCards, MockNotice } from './PlanningUi.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

export default function MemberContributions({ context, targetUserId, onBack }) {
  const [params, setParams] = useSearchParams();
  const statusFilter = Object.hasOwn(statusLabels, params.get('status'))
    ? params.get('status')
    : 'ALL';
  const [downloadError, setDownloadError] = useState(null);
  const downloadExample = (item) => {
    try {
      setDownloadError(null);
      const url = URL.createObjectURL(
        new Blob(
          [
            `미리보기 자료\n${item.title}\n인터뷰 결과를 목적별로 정리하고 주요 발견을 기록했습니다.`,
          ],
          { type: 'text/plain' },
        ),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = item.file.originalFilename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(error);
    }
  };
  const member = context.members.find(
    (member) => member.userId === targetUserId,
  );
  const resource = useResource(
    () =>
      requestPlanned(
        context,
        `/api/teams/${context.team.id}/members/${targetUserId}/contributions`,
      ),
    [context.team.id, targetUserId],
  );
  const feedback = useResource(
    () => getMidFeedback(context),
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
      <div>
        <span className="eyebrow">관리자 읽기 전용</span>
        <h1>{member?.name || '팀원'}님의 수행 상세</h1>
        <p>{context.team.name} · 현재 담당 작업과 최신 자료를 확인합니다.</p>
      </div>
      <MockNotice />
      <ErrorNotice error={downloadError} />
      {resource.data && (
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
                <h3>연결된 최신 산출물</h3>
                {task.deliverableSummary.length ? (
                  task.deliverableSummary.map((item) => (
                    <details className="read-only-deliverable" key={item.id}>
                      <summary>
                        {item.title} ·{' '}
                        {{ TEXT: '문서', FILE: '파일', URL: '링크' }[item.type]}
                      </summary>
                      {item.type === 'FILE' ? (
                        <>
                          <p>{item.file.originalFilename} · 예시 파일</p>
                          <button
                            className="secondary-button"
                            onClick={() => downloadExample(item)}
                          >
                            예시 파일 다운로드
                          </button>
                        </>
                      ) : (
                        <p className="preserve-lines">
                          {item.textOrUrl || '현재 산출물 요약입니다.'}
                        </p>
                      )}
                    </details>
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
      {ownFeedback ? (
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
