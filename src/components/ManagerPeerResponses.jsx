import { useSearchParams } from 'react-router';
import {
  getManagerPeerResponses,
  listEvaluationRounds,
} from '../api/evaluations.js';
import useResource from '../hooks/useResource.js';
import { formatDate } from '../lib/domain.js';
import { roundLabels, roundStatusLabels } from '../lib/evaluation.js';
import { peerCriteria } from '../mock/fixtures.js';
import { EmptyState, Field, ResourceState } from './ui.jsx';

function SubmittedResponses({ roundId, teamId }) {
  const resource = useResource(
    () => getManagerPeerResponses(roundId, teamId),
    [roundId, teamId],
  );
  const result = resource.data;
  return (
    <div className="stack">
      <button className="secondary-button" onClick={resource.reload}>
        평가 원문 새로고침
      </button>
      {resource.error?.code === 'ROUND_NOT_CLOSED' ? (
        <p className="notice">
          마감 정리가 아직 끝나지 않았습니다. 잠시 후 다시 불러와 주세요.
        </p>
      ) : (
        <ResourceState resource={resource}>
          {result && (
            <>
              <p>
                필수 {result.requiredCount}명 · 최종 제출{' '}
                {result.submittedCount}명 · 미제출 {result.missingCount}명
              </p>
              {result.missingCount > 0 && (
                <p className="notice">
                  일부 평가자가 미제출했습니다. 최종 제출된 응답만 표시합니다.
                </p>
              )}
              {result.responses.length ? (
                result.responses.map((response) => (
                  <article
                    className="panel"
                    key={`${response.evaluatorId}:${response.targetId}`}
                  >
                    <h3>
                      {response.evaluatorName} → {response.targetName}
                    </h3>
                    <dl className="card-facts">
                      {Object.entries(peerCriteria).map(([code, label]) => (
                        <div key={code}>
                          <dt>{label}</dt>
                          <dd>{response.scores[code]} / 5</dd>
                        </div>
                      ))}
                    </dl>
                    <h4>작성한 사유</h4>
                    <p className="preserve-lines">
                      {response.reason || '작성한 사유가 없습니다.'}
                    </p>
                    <p className="field-help">
                      최종 제출 {formatDate(response.submittedAt)}
                    </p>
                  </article>
                ))
              ) : (
                <EmptyState>최종 제출된 평가 응답이 없습니다.</EmptyState>
              )}
            </>
          )}
        </ResourceState>
      )}
    </div>
  );
}

export default function ManagerPeerResponses({ context, teamId }) {
  const [params, setParams] = useSearchParams();
  const rounds = useResource(
    () => listEvaluationRounds(context.space.id),
    [context.space.id],
  );
  const selectedTeamId =
    teamId || params.get('peerTeamId') || context.teamContexts[0]?.team.id;
  const selectedRound =
    rounds.data?.find(
      (round) => String(round.id) === params.get('peerRoundId'),
    ) ||
    rounds.data?.find((round) => round.status === 'CLOSED') ||
    rounds.data?.[0];
  const select = (name, value) => {
    const next = new URLSearchParams(params);
    next.set(name, value);
    setParams(next);
  };
  return (
    <section className="panel stack" aria-label="관리자 동료 평가 상세">
      <div>
        <span className="eyebrow">관리자 전용 · 읽기 전용</span>
        <h2>동료 평가 원문</h2>
        <p>
          마감된 회차의 최종 제출 점수와 사유입니다. 임시 저장 응답은 표시하지
          않습니다.
        </p>
      </div>
      <button
        className="secondary-button"
        disabled={rounds.loading}
        onClick={rounds.reload}
      >
        원문 조회 회차 새로고침
      </button>
      {!teamId && (
        <Field label="평가 원문 대상 팀">
          <select
            value={selectedTeamId || ''}
            onChange={(event) => select('peerTeamId', event.target.value)}
          >
            {context.teamContexts.map(({ team }) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <ResourceState resource={rounds}>
        {selectedRound && selectedTeamId ? (
          <>
            <Field label="원문 조회 회차">
              <select
                value={selectedRound.id}
                onChange={(event) => select('peerRoundId', event.target.value)}
              >
                {rounds.data.map((round) => (
                  <option key={round.id} value={round.id}>
                    {roundLabels[round.type]} ·{' '}
                    {roundStatusLabels[round.status]}
                  </option>
                ))}
              </select>
            </Field>
            {selectedRound.status === 'CLOSED' ? (
              <SubmittedResponses
                key={`${selectedRound.id}:${selectedTeamId}`}
                roundId={selectedRound.id}
                teamId={selectedTeamId}
              />
            ) : (
              <p className="notice">
                회차 마감 후 최종 제출된 평가를 조회할 수 있습니다.
              </p>
            )}
          </>
        ) : (
          <EmptyState>조회할 팀과 평가 회차가 필요합니다.</EmptyState>
        )}
      </ResourceState>
    </section>
  );
}
