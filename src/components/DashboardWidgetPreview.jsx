import TeamDashboardWidget from './TeamDashboardWidget.jsx';

const userId = 'widget-example-user';
const today = '2026-11-11';
const now = Date.parse(`${today}T12:00:00+09:00`);
const context = {
  team: { id: 'widget-example-team', name: '예시 팀' },
  user: { id: userId },
  members: [
    { userId, name: '김하늘', role: 'LEADER' },
    { userId: 'widget-example-member', name: '이지원', role: 'MEMBER' },
  ],
};
const resource = data => ({ data, loading: false, error: null, reload: () => {} });
const summaryResource = resource({
  teamProgressRate: 62.5, myAssignedShare: 40, myCompletedContributionRate: 25,
  myTaskCompletionRate: 62.5, myOverdueTaskCount: 1, teamTotalWeight: 80,
  asOf: `${today}T12:00:00`,
});
const taskResource = resource([
  { id: 1, title: '설문 결과 분석', status: 'IN_PROGRESS', dueAt: '2026-11-10T18:00:00', assignees: [{ userId }] },
  { id: 2, title: '서비스 흐름 정리', status: 'REVISING', dueAt: '2026-11-13T18:00:00', assignees: [{ userId }] },
  { id: 3, title: '발표 자료 준비', status: 'TODO', dueAt: '2026-11-15T18:00:00', assignees: [{ userId }] },
  { id: 4, title: '사용자 조사', status: 'DONE', dueAt: '2026-11-09T18:00:00', assignees: [{ userId }] },
]);
const reportResource = resource({
  status: 'PUBLISHED', weights: { taskPercent: 70, midPercent: 10, finalPercent: 20 },
  members: [{ userId, totalScore: 82.5 }],
});

export default function DashboardWidgetPreview({ widget }) {
  return <section className="widget-catalog-preview" role="region" aria-label={`${widget.title} 위젯 미리보기`}>
    <header className="widget-catalog-preview-heading"><strong>미리보기</strong><span>예시 화면</span></header>
    <div className="dashboard-arrange-grid dashboard-preview-canvas" inert aria-hidden="true">
      <article className={`dashboard-preview-widget widget-${widget.id}`}>
        <TeamDashboardWidget id={widget.id} context={context} preview
          summaryResource={summaryResource} taskResource={taskResource} reportResource={reportResource}
          today={today} now={now} memo={'다음 회의에서 공유할 내용\n\n• 설문 결과 함께 검토하기\n• 발표 자료 역할 나누기'}
        />
      </article>
    </div>
  </section>;
}
