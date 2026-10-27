import { useState } from 'react';
import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useSearchParams } from 'react-router';
import ReportBatchGeneration from './ReportBatchGeneration.jsx';
import { TeamReport } from './ContributionReport.jsx';
import { getTeam } from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import { EmptyState, Field, ResourceState } from './ui.jsx';

export default function ReportReview({ context }) {
  const guide = usePreviewGuide();
  const [params, setParams] = useSearchParams();
  const [toolbarTarget, setToolbarTarget] = useState(null);
  const [generationRevision, setGenerationRevision] = useState(0);
  const team =
    context.teams.find((team) => String(team.id) === params.get('teamId')) ||
    context.teams[0];
  const detail = useResource(
    () => (team ? getTeam(team.id) : Promise.resolve(null)),
    [team?.id, guide?.scope],
  );
  return (
    <section className="stack space-operation-page report-review-page">
      <div className="page-heading">
        <div>
          <h1>리포트 관리</h1>
        </div>
      </div>
      {team ? (
        <>
          <ReportBatchGeneration key={`${context.space.id}:${guide?.scope || 'free'}`} context={context} onGenerated={() => setGenerationRevision((value) => value + 1)} />
          <div className="report-team-toolbar">
            <Field label="리포트 대상 팀">
              <select
                data-guide={guide?.guiding && guide.scenarioId === 'report-management' && team.id !== guide.reportManagementTeamId ? 'choose-report-guide-team' : undefined}
                value={team.id}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  next.set('teamId', event.target.value);
                  next.delete('tab');
                  next.delete('peerRoundId');
                  setParams(next);
                }}
              >
                {context.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </Field>
            {detail.data && <p>팀원 {detail.data.approvedMemberCount}명</p>}
            <div className="report-toolbar-slot" ref={setToolbarTarget} />
          </div>
          <ResourceState resource={detail} label="리포트 대상 팀">
            {detail.data && <TeamReport key={team.id} manager generationRevision={generationRevision} toolbarTarget={toolbarTarget} context={{ ...context, team: detail.data }} />}
          </ResourceState>
        </>
      ) : (
        <EmptyState>리포트를 만들 팀이 없습니다.</EmptyState>
      )}
    </section>
  );
}
