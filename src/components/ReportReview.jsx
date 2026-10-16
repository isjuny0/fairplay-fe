import { useSearchParams } from 'react-router';
import { TeamReport } from './ContributionReport.jsx';
import { EmptyState, Field } from './ui.jsx';

export default function ReportReview({ context }) {
  const [params, setParams] = useSearchParams();
  const entry =
    context.teamContexts.find(
      ({ team }) => String(team.id) === params.get('teamId'),
    ) || context.teamContexts[0];
  return (
    <section className="stack report-review-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">최종 결과 운영</span>
          <h1>리포트 검토·공개</h1>
          <p>
            팀별 결과를 검토한 뒤 공개하세요. 공개 전 리포트는 팀원에게 보이지
            않습니다.
          </p>
        </div>
      </div>
      {entry ? (
        <>
          <div className="report-team-toolbar">
            <Field label="리포트 대상 팀">
              <select
                value={entry.team.id}
                onChange={(event) => setParams({ teamId: event.target.value })}
              >
                {context.teamContexts.map(({ team }) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </Field>
            <p>팀원 {entry.team.approvedMemberCount}명</p>
            <span className="field-help">
              선택한 팀의 평가 제출과 최종 결과를 확인합니다.
            </span>
          </div>
          <TeamReport
            key={entry.team.id}
            manager
            context={{ ...context, team: entry.team, members: entry.members }}
          />
        </>
      ) : (
        <EmptyState>리포트를 만들 팀이 없습니다.</EmptyState>
      )}
    </section>
  );
}
