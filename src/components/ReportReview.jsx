import { useSearchParams } from 'react-router';
import { MockNotice } from './PlanningUi.jsx';
import { ReportList } from './ContributionReport.jsx';
import { EmptyState, Field } from './ui.jsx';

export default function ReportReview({ context }) {
  const [params, setParams] = useSearchParams();
  const entry =
    context.teamContexts.find(
      ({ team }) => String(team.id) === params.get('teamId'),
    ) || context.teamContexts[0];
  return (
    <section className="stack">
      <div>
        <span className="eyebrow">최종 결과 운영</span>
        <h1>리포트 검토·공개</h1>
        <p>
          팀별 결과를 검토한 뒤 공개하세요. 공개 전 초안은 팀원에게 보이지
          않습니다.
        </p>
      </div>
      <MockNotice />
      {entry ? (
        <>
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
          <ReportList
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
