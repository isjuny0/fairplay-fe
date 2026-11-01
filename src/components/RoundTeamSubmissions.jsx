import { useSearchParams } from 'react-router';
import { getRoundTeamView } from '../lib/roundTeamManagement.js';
import { roundLabels } from '../lib/evaluation.js';
import { ProgressBar } from './PlanningUi.jsx';
import { Field } from './ui.jsx';

export default function RoundTeamSubmissions({ round, teams, directory, loading, onViewResults }) {
  const [params, setParams] = useSearchParams();
  const prefix = `submission${round.type}`;
  const query = params.get(`${prefix}Search`) || '';
  const status = params.get(`${prefix}Status`) || 'all';
  const sort = params.get(`${prefix}Sort`) || 'missing';
  const names = new Map(directory.map((team) => [String(team.id), team.name]));
  const view = getRoundTeamView(teams.map((team) => ({ ...team, name: names.get(String(team.teamId)) || `팀 #${team.teamId}` })), {
    query, status, sort, page: params.get(`${prefix}Page`) || 1,
  });
  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all' && !(key === 'Sort' && value === 'missing') && !(key === 'Page' && value === 1)) next.set(`${prefix}${key}`, String(value));
    else next.delete(`${prefix}${key}`);
    if (key !== 'Page') next.delete(`${prefix}Page`);
    setParams(next, { replace: key === 'Search' });
  };
  const reset = () => {
    const next = new URLSearchParams(params);
    for (const key of ['Search', 'Status', 'Sort', 'Page']) next.delete(`${prefix}${key}`);
    setParams(next);
  };
  const filtered = Boolean(query || status !== 'all' || sort !== 'missing');
  return <div className="round-team-manager" aria-busy={loading}>
    <div className="round-team-heading"><h3>팀별 제출 현황</h3><span>10팀씩 보기</span></div>
    <dl className="round-submission-summary" aria-label={`${roundLabels[round.type]} 제출 요약`}>
      <div><dt>전체 팀</dt><dd>{view.summary.total}<small>팀</small></dd></div>
      <div><dt>전원 제출</dt><dd>{view.summary.complete}<small>팀</small></dd></div>
      <div><dt>미제출 팀</dt><dd className={view.summary.pending ? 'round-attention' : ''}>{view.summary.pending}<small>팀</small></dd></div>
      <div><dt>미제출 인원</dt><dd className={view.summary.missing ? 'round-attention' : ''}>{view.summary.missing}<small>명</small></dd></div>
    </dl>
    <div className="round-team-filters" role="group" aria-label={`${roundLabels[round.type]} 팀 검색·필터`}>
      <Field label="팀 이름 검색"><input type="search" value={query} placeholder="팀 이름으로 검색" onChange={(event) => update('Search', event.target.value)} /></Field>
      <Field label="제출 상태"><select value={['all', 'missing', 'submitted'].includes(status) ? status : 'all'} onChange={(event) => update('Status', event.target.value)}>
        <option value="all">전체 팀</option><option value="missing">미제출 있음</option><option value="submitted">전원 제출</option>
      </select></Field>
      <Field label="팀 정렬"><select value={['missing', 'progress', 'name'].includes(sort) ? sort : 'missing'} onChange={(event) => update('Sort', event.target.value)}>
        <option value="missing">미제출 많은 순</option><option value="progress">제출률 낮은 순</option><option value="name">팀 이름 순</option>
      </select></Field>
    </div>
    <div className="round-team-list-meta"><span role="status">전체 {view.summary.total}팀 중 {view.count}팀</span>{filtered && <button type="button" className="text-button" onClick={reset}>검색·필터 초기화</button>}</div>
    {view.count ? <>
      <div className="round-team-columns" aria-hidden="true"><span>팀</span><span>제출 인원</span><span>제출률</span><span>상태</span><span /></div>
      <ul className="round-team-submissions">{view.teams.map((team) => <li key={team.teamId}>
        <strong>{team.name}</strong>
        <span>{team.requiredCount}명 중 {team.submittedCount}명 제출</span>
        <ProgressBar value={team.requiredCount > 0 ? team.submittedCount / team.requiredCount * 100 : null} label={`${roundLabels[round.type]} ${team.name} 제출률`} />
        <span className={team.missingCount > 0 ? 'round-missing-count' : 'round-table-note'}>{team.requiredCount === 0 ? '평가 대상 없음' : team.missingCount > 0 ? `미제출 ${team.missingCount}명` : '전원 제출'}</span>
        {round.status === 'CLOSED' ? <button type="button" className="secondary-button round-result-link" aria-label={`${team.name} ${roundLabels[round.type]} 결과 보기`} onClick={() => onViewResults(team.teamId)}>결과 보기</button> : <span className="round-result-placeholder" />}
      </li>)}</ul>
    </> : <div className="round-team-empty"><strong>조건에 맞는 팀이 없습니다.</strong><span>팀 이름이나 제출 상태를 변경해 보세요.</span></div>}
    {view.pageCount > 1 && <nav className="round-team-pagination" aria-label={`${roundLabels[round.type]} 팀 목록 페이지`}>
      <button type="button" className="secondary-button" disabled={view.page === 1} onClick={() => update('Page', view.page - 1)}>이전</button>
      <span>{view.page} / {view.pageCount}페이지</span>
      <button type="button" className="secondary-button" disabled={view.page === view.pageCount} onClick={() => update('Page', view.page + 1)}>다음</button>
    </nav>}
  </div>;
}
