import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validReportWorkload } from '../src/lib/reportWorkload.js';

const summary = () => ({ equalSharePercent: 50, formerMemberCompletedWorkSharePercent: 0, members: [
  { userId: 'a', name: '김준영', completedWorkSharePercent: 100, relativeToTeamAveragePercent: 200 },
  { userId: 'b', name: '김영진', completedWorkSharePercent: 0, relativeToTeamAveragePercent: 0 },
] });

test('작업량 요약은 100% 초과 평균 대비 비율과 완료 작업량 0을 허용한다', () => {
  assert.equal(validReportWorkload(summary(), 2), true);
  const unavailable = summary();
  unavailable.formerMemberCompletedWorkSharePercent = null;
  unavailable.members.forEach((member) => { member.completedWorkSharePercent = null; member.relativeToTeamAveragePercent = null; });
  assert.equal(validReportWorkload(unavailable, 2), true);
});

test('이전 응답과 잘못된 작업량 요약은 표시 대상으로 사용하지 않는다', () => {
  for (const value of [undefined, null, {}, { ...summary(), members: [summary().members[0]] },
    { ...summary(), members: [summary().members[0], summary().members[0]] },
    { ...summary(), equalSharePercent: NaN }, { ...summary(), formerMemberCompletedWorkSharePercent: -1 },
    { ...summary(), formerMemberCompletedWorkSharePercent: null }]) {
    assert.equal(validReportWorkload(value, 2), false);
  }
  const invalid = summary();
  invalid.members[0].relativeToTeamAveragePercent = 201;
  assert.equal(validReportWorkload(invalid, 2), false);
});
