import { useRef, useState } from 'react';
import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useSearchParams } from 'react-router';
import ReportBatchGeneration from './ReportBatchGeneration.jsx';
import { TeamReport } from './ContributionReport.jsx';
import { getTeam } from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import RefreshButton from './RefreshButton.jsx';
import { EmptyState, Modal, ResourceState } from './ui.jsx';
import '../report-management.css';

const statusLabels = { NOT_GENERATED: '미생성', UNPUBLISHED: '미공개', PUBLISHED: '공개 완료' };
const reportStatus = (team) => team.reportId == null ? 'NOT_GENERATED' : team.reportStatus;

function ReportDrawer({ context, teamId, revision, onClose }) {
  const guide = usePreviewGuide();
  const detail = useResource(() => getTeam(teamId), [teamId, guide?.scope]);
  const teamName = context.teams.find((team) => team.id === teamId)?.name || '팀';
  return <Modal title={`${teamName} 리포트`} className="report-detail-drawer" onClose={onClose}>
    <div className="report-drawer-content">
      <ResourceState resource={detail} label="리포트 대상 팀">
        {detail.data && <>
          <TeamReport manager hideRefresh
            generationRevision={revision} onGuideComplete={onClose}
            context={{ ...context, team: detail.data }} />
        </>}
      </ResourceState>
    </div>
    <div className="report-drawer-footer"><button className="secondary-button" onClick={onClose}>목록으로 돌아가기</button></div>
  </Modal>;
}

export default function ReportReview({ context }) {
  const guide = usePreviewGuide();
  const [params, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reportTeams, setReportTeams] = useState(null);
  const listSection = useRef(null);
  const hasGeneratedReports = reportTeams?.some((team) => team.reportId != null);
  const selectedTeam = context.teams.find((team) => String(team.id) === params.get('teamId'));
  const refresh = () => setRevision((value) => value + 1);
  const selectTeam = (id) => {
    const next = new URLSearchParams(params);
    if (id == null) next.delete('teamId');
    else next.set('teamId', String(id));
    next.delete('tab');
    next.delete('peerRoundId');
    setParams(next, { preventScrollReset: true });
    if (id == null) requestAnimationFrame(() => {
      const button = listSection.current?.querySelector(`[data-report-team="${selectedTeam?.id}"]`);
      button?.focus({ preventScroll: true });
    });
  };
  return <section className="stack space-operation-page report-review-page">
    <div className="page-heading">
      <h1>리포트 관리</h1>
      <RefreshButton label="리포트 관리 새로고침" disabled={busy} onClick={refresh} />
    </div>
    {context.teams.length ? <>
      <ReportBatchGeneration key={`${context.space.id}:${guide?.scope || 'free'}`} context={context}
        refreshRevision={revision} onBusyChange={setBusy} onReadinessLoaded={setReportTeams} onGenerated={refresh} />
      {hasGeneratedReports && <section ref={listSection} className="report-results-section" aria-label="팀별 리포트 결과">
        <div className="report-list-heading">
          <h2>팀별 리포트</h2>
          <span className="report-team-count">전체 {reportTeams.length}팀</span>
        </div>
        <div className="table-scroll" role="region" aria-label="팀별 리포트 목록" tabIndex={0}>
          <table className="data-table report-management-table">
            <thead><tr><th scope="col">팀</th><th scope="col">리포트 상태</th><th scope="col"><span className="sr-only">리포트 확인</span></th></tr></thead>
            <tbody>{reportTeams.map((team) => {
              const status = reportStatus(team);
              return <tr key={team.teamId}>
                <th scope="row">{team.teamName}</th>
                <td><span className={`report-list-status status-${status?.toLowerCase() || 'unknown'}`}>{statusLabels[status] || '상태 확인 필요'}</span></td>
                <td>{team.reportId == null ? <span className="field-help">생성 대기</span> : <button
                  className="secondary-button" aria-label={`${team.teamName} 리포트 확인`}
                  data-report-team={team.teamId}
                  data-guide={guide?.guiding && guide.scenarioId === 'report-management' && team.teamId === guide.reportManagementTeamId && selectedTeam?.id !== team.teamId ? 'choose-report-guide-team' : undefined}
                  onClick={() => selectTeam(team.teamId)}>리포트 확인</button>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>}
      {selectedTeam && <ReportDrawer key={selectedTeam.id} context={context} teamId={selectedTeam.id}
        revision={revision} onClose={() => selectTeam(null)} />}
    </> : <EmptyState>리포트를 만들 팀이 없습니다.</EmptyState>}
  </section>;
}
