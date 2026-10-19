import { useSearchParams } from 'react-router';
import { TeamReport } from './ContributionReport.jsx';
import { getTeam } from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import { EmptyState, Field, ResourceState } from './ui.jsx';

export default function ReportReview({ context }) {
  const [params, setParams] = useSearchParams();
  const team =
    context.teams.find((team) => String(team.id) === params.get('teamId')) ||
    context.teams[0];
  const detail = useResource(
    () => (team ? getTeam(team.id) : Promise.resolve(null)),
    [team?.id],
  );
  return (
    <section className="stack report-review-page">
      <div className="page-heading">
        <div>
          <h1>리포트 검토·공개</h1>
          <p>
            팀별 결과를 검토한 뒤 공개하세요. 공개 전 리포트는 팀원에게 보이지
            않습니다.
          </p>
        </div>
      </div>
      {team ? (
        <>
          <div className="report-team-toolbar">
            <Field label="리포트 대상 팀">
              <select
                value={team.id}
                onChange={(event) => setParams({ teamId: event.target.value })}
              >
                {context.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </Field>
            {detail.data && <p>팀원 {detail.data.approvedMemberCount}명</p>}
            <span className="field-help">
              선택한 팀의 평가 제출과 최종 결과를 확인합니다.
            </span>
          </div>
          <ResourceState resource={detail} label="리포트 대상 팀">
            {detail.data && (
              <TeamReport
                key={team.id}
                manager
                context={{ ...context, team: detail.data }}
              />
            )}
          </ResourceState>
        </>
      ) : (
        <EmptyState>리포트를 만들 팀이 없습니다.</EmptyState>
      )}
    </section>
  );
}
