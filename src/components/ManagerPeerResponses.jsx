import { useId, useState } from 'react';
import RefreshButton from './RefreshButton.jsx';
import { useSearchParams } from 'react-router';
import {
  getManagerPeerResponses,
  listEvaluationRounds,
} from '../api/evaluations.js';
import useResource from '../hooks/useResource.js';
import { formatDate } from '../lib/domain.js';
import { roundLabels, roundStatusLabels } from '../lib/evaluation.js';
import { peerCriteria } from '../lib/peerCriteria.js';
import { EmptyState, Field, ResourceState } from './ui.jsx';

function ResponseTable({ group, compact = false }) {
  return (
    <div className="manager-peer-table-container">
      <table className="manager-peer-table">
        <caption className="sr-only">{group.name}님이 받은 최종 제출 평가</caption>
        <thead><tr>
          <th scope="col">{compact ? '평가자' : '평가자 → 대상자'}</th>
          {Object.entries(peerCriteria).map(([code, label]) => <th key={code} scope="col">{label}</th>)}
          <th scope="col">최종 제출</th>
        </tr></thead>
        {group.responses.map((response) => (
          <tbody key={`${response.evaluatorId}:${response.targetId}`}>
            <tr className="manager-peer-score-row">
              <th scope="row">{response.evaluatorName}{!compact && ` → ${response.targetName}`}</th>
              {Object.entries(peerCriteria).map(([code, label]) => (
                <td key={code} data-label={label}><span>{response.scores[code] ?? '—'} <small>/ 5</small></span></td>
              ))}
              <td className="manager-peer-submitted-at" data-label="최종 제출"><time dateTime={response.submittedAt}>{formatDate(response.submittedAt)}</time></td>
            </tr>
            <tr className="manager-peer-reason-row"><td colSpan={6}>
              <span className="manager-peer-reason-label">작성한 사유</span>
              <p className="preserve-lines">{response.reason || '작성한 사유가 없습니다.'}</p>
            </td></tr>
          </tbody>
        ))}
      </table>
    </div>
  );
}

function SubmittedResponses({ roundId, teamId, compact = false, selectedTargetId, onSelectTarget, refreshVersion }) {
  const resource = useResource(
    () => getManagerPeerResponses(roundId, teamId),
    [roundId, teamId, refreshVersion],
  );
  const detailId = useId();
  const result = resource.data;
  const targetGroups = result
    ? Object.values(result.responses.reduce((groups, response) => {
        groups[response.targetId] ||= { targetId: response.targetId, name: response.targetName, responses: [] };
        groups[response.targetId].responses.push(response);
        return groups;
      }, {}))
    : [];
  const selectedTarget = targetGroups.find((group) => group.targetId === selectedTargetId) || targetGroups[0];
  const refresh = <RefreshButton label="평가 결과 새로고침" disabled={resource.loading} onClick={resource.reload} />;
  return (
    <div className={`stack manager-peer-results${compact ? ' manager-peer-results--compact' : ''}`}>
      {!compact && <div className="manager-peer-results-heading"><h3>최종 제출 현황</h3>{refresh}</div>}
      {resource.error?.code === 'ROUND_NOT_CLOSED' ? (
        <p className="notice">마감 정리가 아직 끝나지 않았습니다. 잠시 후 다시 불러와 주세요.</p>
      ) : (
        <ResourceState resource={resource} label="최종 제출 평가 원문">
          {result && <>
            <div className="manager-peer-submission-bar">
              <div className="manager-peer-submission-summary" role="group" aria-label="평가 제출 현황">
                {compact ? <>
                  <span>최종 제출 <strong>{result.submittedCount} / {result.requiredCount}명</strong></span>
                  <span className={result.missingCount > 0 ? 'peer-missing-submissions' : ''}>미제출 <strong>{result.missingCount}명</strong></span>
                </> : <>
                  <span>필수 {result.requiredCount}명</span><span>최종 제출 {result.submittedCount}명</span><span>미제출 {result.missingCount}명</span>
                </>}
              </div>
            </div>
            {result.missingCount > 0 && <p className="notice">일부 평가자가 미제출했습니다. 최종 제출된 응답만 표시합니다.</p>}
            {!selectedTarget ? <EmptyState>최종 제출된 평가 응답이 없습니다.</EmptyState> : compact ? (
              <div className="peer-original-layout">
                <nav className="peer-original-targets" aria-label="평가받은 팀원">
                  <h3>평가받은 팀원 <span>{targetGroups.length}명</span></h3>
                  {targetGroups.map((group) => (
                    <button type="button" key={group.targetId} aria-label={`${group.name} 받은 평가 ${group.responses.length}건`}
                      aria-pressed={selectedTarget.targetId === group.targetId} aria-controls={detailId}
                      onClick={() => onSelectTarget(group.targetId)}>
                      <span>{group.name}</span><span>{group.responses.length}건</span>
                    </button>
                  ))}
                </nav>
                <section id={detailId} className="peer-original-detail" role="region" aria-label="선택한 팀원 받은 평가">
                  <div className="peer-original-detail-heading"><h3>{selectedTarget.name}님이 받은 평가</h3><span>최종 제출 {selectedTarget.responses.length}건 · 항목별 5점 만점</span></div>
                  <ResponseTable group={selectedTarget} compact />
                </section>
              </div>
            ) : targetGroups.map((group) => (
              <details className="peer-target-responses" key={group.targetId}>
                <summary>{group.name} 받은 평가 · {group.responses.length}건</summary>
                <ResponseTable group={group} />
              </details>
            ))}
          </>}
        </ResourceState>
      )}
    </div>
  );
}

function PeerResponseContent({ context, teamId, compact = false }) {
  const [targetSelection, setTargetSelection] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [params, setParams] = useSearchParams();
  const rounds = useResource(
    () => listEvaluationRounds(context.space.id),
    [context.space.id],
  );
  const selectedTeamId =
    teamId || params.get('peerTeamId') || context.teams[0]?.id;
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
  const selectedTeamName = context.teams.find(
    (team) => String(team.id) === String(selectedTeamId),
  )?.name;
  return (
    <div className={`stack peer-response-content${compact ? ' peer-response-content--compact' : ''}`}>
      {!compact && <div className="manager-peer-heading">
        <div>
          <h2>동료 평가 결과</h2>
          <p>
            마감된 회차의 최종 제출 점수와 사유입니다. 임시 저장 응답은 표시하지
            않습니다.
          </p>
        </div>
        <RefreshButton
          label="결과 조회 회차 새로고침"
          disabled={rounds.loading}
          onClick={rounds.reload}
        />
      </div>}
      {compact && <h2 className="sr-only">동료 평가 결과</h2>}
      <ResourceState resource={rounds} label="평가 회차">
        <div className="manager-peer-scope" aria-label="결과 조회 범위">
          {!teamId ? (
            <Field label="평가 결과 대상 팀">
              <select
                value={selectedTeamId || ''}
                onChange={(event) => select('peerTeamId', event.target.value)}
              >
                {context.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : !compact ? (
            <div className="manager-peer-fixed-team">
              <span>조회 팀</span>
              <strong>{selectedTeamName || `팀 #${selectedTeamId}`}</strong>
            </div>
          ) : null}
          {selectedRound && (
            <Field label="결과 조회 회차">
              <select
                value={selectedRound.id}
                onChange={(event) => select('peerRoundId', event.target.value)}
              >
                {rounds.data.map((round) => (
                  <option key={round.id} value={round.id}>
                    {roundLabels[round.type]}{round.status !== 'CLOSED' && ` · ${roundStatusLabels[round.status]}`}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {compact && <RefreshButton label="평가 결과 새로고침" disabled={rounds.loading} onClick={() => { rounds.reload(); setRefreshVersion((version) => version + 1); }} />}
        </div>
        {selectedRound && selectedTeamId ? (
          <>
            {selectedRound.status === 'CLOSED' ? (
              <SubmittedResponses
                key={`${selectedRound.id}:${selectedTeamId}`}
                roundId={selectedRound.id}
                teamId={selectedTeamId}
                compact={compact}
                refreshVersion={refreshVersion}
                selectedTargetId={targetSelection?.scope === `${selectedRound.id}:${selectedTeamId}` ? targetSelection.targetId : null}
                onSelectTarget={(targetId) => setTargetSelection({ scope: `${selectedRound.id}:${selectedTeamId}`, targetId })}
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
      {compact && <p className="peer-original-note">관리자만 확인할 수 있는 최종 제출 결과입니다. 임시 저장 응답은 포함하지 않습니다.</p>}
    </div>
  );
}

export default function ManagerPeerResponses({ context, teamId, expanded = false }) {
  const [open, setOpen] = useState(false);
  return (
    <section
      className="panel peer-response-panel"
      aria-label="관리자 동료 평가 상세"
    >
      {expanded ? <PeerResponseContent context={context} teamId={teamId} compact /> : (
        <details onToggle={(event) => setOpen(event.currentTarget.open)}>
          <summary>동료 평가 결과 보기</summary>
          {open && <PeerResponseContent context={context} teamId={teamId} />}
        </details>
      )}
    </section>
  );
}
