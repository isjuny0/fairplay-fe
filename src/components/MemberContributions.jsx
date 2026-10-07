import { useState } from 'react';
import { ErrorNotice } from './ui.jsx';
import { requestPlanned, getMidFeedback } from '../api/planned.js';
import useResource from '../hooks/useResource.js';
import { formatDate, statusLabels } from '../lib/domain.js';
import { FeedbackCards, MockNotice } from './PlanningUi.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

export default function MemberContributions({ context, targetUserId, onBack }) {
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
      <ResourceState resource={resource}>
        {resource.data?.length ? (
          resource.data.map((task) => (
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
                가중치 {task.weight} · 본인 배분 {task.allocationPercent}% ·
                마감 {formatDate(task.dueAt)}
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
                      {item.title} · {item.type}
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
      {ownFeedback ? (
        <>
          <h2>MID 수신 평균과 개선 안내</h2>
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
