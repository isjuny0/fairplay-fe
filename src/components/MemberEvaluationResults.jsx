import {
  getManagerPeerResponses,
  listEvaluationRounds,
} from '../api/evaluations.js';
import useResource from '../hooks/useResource.js';
import { formatDate } from '../lib/domain.js';
import { roundLabels, roundStatusLabels } from '../lib/evaluation.js';
import { peerCriteria } from '../lib/peerCriteria.js';
import { ResourceState } from './ui.jsx';

function MemberRoundScores({ round, teamId, targetUserId, revision }) {
  const resource = useResource(
    () => getManagerPeerResponses(round.id, teamId),
    [round.id, teamId, targetUserId, revision],
  );
  const result = resource.data;
  const receivedResponses =
    result?.responses.filter(
      (response) => response.targetId === targetUserId,
    ) || [];
  if (resource.error?.code === 'ROUND_NOT_CLOSED')
    return (
      <div>
        <p className="notice">
          마감 정리가 아직 끝나지 않았습니다. 정리가 끝난 뒤 결과를 확인할 수
          있습니다.
        </p>
        <button className="secondary-button" onClick={resource.reload}>
          평가 결과 다시 불러오기
        </button>
      </div>
    );
  return (
    <ResourceState resource={resource}>
      {result && (
        <>
          <p className="member-evaluation-counts">
            팀 제출 {result.submittedCount}/{result.requiredCount}명 · 수신 평가{' '}
            {receivedResponses.length}건
          </p>
          {result.missingCount > 0 && (
            <p className="notice">
              팀 전체 미제출 {result.missingCount}명 · 현재 최종 제출된 평가만
              반영한 결과입니다.
            </p>
          )}
          {receivedResponses.length ? (
            <dl className="member-evaluation-scores">
              {Object.entries(peerCriteria).map(([criterion, label]) => (
                <div key={criterion}>
                  <dt>{label}</dt>
                  <dd>
                    {(
                      receivedResponses.reduce(
                        (sum, response) => sum + response.scores[criterion],
                        0,
                      ) / receivedResponses.length
                    ).toFixed(2)}{' '}
                    <span>/ 5</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="field-help">
              이 팀원에게 최종 제출된 평가가 없습니다.
            </p>
          )}
        </>
      )}
    </ResourceState>
  );
}

export default function MemberEvaluationResults({
  spaceId,
  teamId,
  targetUserId,
  revision,
}) {
  const resource = useResource(
    () => listEvaluationRounds(spaceId),
    [spaceId, revision],
  );
  return (
    <section
      className="member-evaluation-results"
      aria-label="팀원의 동료 평가 결과"
    >
      <h2>동료 평가 결과</h2>
      <ResourceState resource={resource}>
        {resource.data && (
          <div className="member-evaluation-rounds">
            {['MID', 'FINAL'].map((type) => {
              const round = resource.data.find((entry) => entry.type === type);
              return (
                <section
                  className="member-evaluation-round"
                  key={type}
                  aria-label={`${roundLabels[type]} 결과`}
                >
                  <div className="section-heading">
                    <h3>{roundLabels[type]}</h3>
                    <span className="field-help">
                      {round ? roundStatusLabels[round.status] : '회차 미설정'}
                    </span>
                  </div>
                  {round ? (
                    <>
                      <p className="field-help">
                        마감 {formatDate(round.closesAt)}
                      </p>
                      {round.status === 'CLOSED' ? (
                        <MemberRoundScores
                          key={`${teamId}:${targetUserId}:${round.id}`}
                          round={round}
                          teamId={teamId}
                          targetUserId={targetUserId}
                          revision={revision}
                        />
                      ) : (
                        <p className="field-help">
                          {round.status === 'DRAFT'
                            ? '평가 시작 전입니다.'
                            : '평가 진행 중입니다.'}{' '}
                          회차 마감 후 결과를 확인할 수 있습니다.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="field-help">
                      아직 평가 회차가 생성되지 않았습니다.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </ResourceState>
    </section>
  );
}
