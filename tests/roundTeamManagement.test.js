import test from 'node:test';
import assert from 'node:assert/strict';
import { getRoundTeamView } from '../src/lib/roundTeamManagement.js';

const teams = Array.from({ length: 27 }, (_, index) => ({
  teamId: index + 1, name: `팀 ${index + 1}`, requiredCount: 4,
  submittedCount: index % 5, missingCount: 4 - index % 5,
}));

test('다수 팀은 10개씩 표시하고 전체 요약은 페이지와 필터에 영향받지 않는다', () => {
  const view = getRoundTeamView(teams);
  assert.equal(view.teams.length, 10);
  assert.equal(view.pageCount, 3);
  assert.equal(view.summary.total, 27);
  assert.equal(view.summary.complete, 5);
  assert.equal(view.summary.pending, 22);
  assert.equal(view.summary.missing, teams.reduce((sum, team) => sum + team.missingCount, 0));
  assert.deepEqual(getRoundTeamView(teams, { query: '팀 1', page: 2 }).summary, view.summary);
});

test('미제출 많은 순이 기본이며 동률은 숫자를 고려한 팀 이름 순이다', () => {
  const original = structuredClone(teams);
  assert.deepEqual(getRoundTeamView(teams).teams.slice(0, 6).map((team) => team.teamId), [1, 6, 11, 16, 21, 26]);
  assert.deepEqual(teams, original);
  assert.deepEqual(getRoundTeamView(teams, { sort: 'name' }).teams.map((team) => team.teamId), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('검색과 제출 상태를 함께 적용하고 빈 결과를 안전하게 표시한다', () => {
  const complete = getRoundTeamView(teams, { status: 'submitted' });
  assert.equal(complete.count, 5);
  assert.ok(complete.teams.every((team) => team.missingCount === 0));
  const pending = getRoundTeamView(teams, { query: '  팀 1 ', status: 'missing' });
  assert.ok(pending.teams.every((team) => team.name.includes('팀 1') && team.missingCount > 0));
  const empty = getRoundTeamView(teams, { query: '없는 팀', page: 999 });
  assert.equal(empty.count, 0);
  assert.equal(empty.page, 1);
  assert.deepEqual(empty.teams, []);
});

test('대상 인원 0인 팀은 전원 제출에 포함하지 않고 제출률 정렬에서 마지막이다', () => {
  const rows = [...teams.slice(0, 3), { teamId: 99, name: '대상 없음', requiredCount: 0, submittedCount: 0, missingCount: 0 }];
  assert.equal(getRoundTeamView(rows, { status: 'submitted' }).count, 0);
  assert.equal(getRoundTeamView(rows).summary.complete, 0);
  assert.equal(getRoundTeamView(rows, { sort: 'progress' }).teams.at(-1).teamId, 99);
});

test('범위를 벗어난 페이지·잘못된 URL 값과 중복 팀 이름을 안정적으로 처리한다', () => {
  for (const page of ['abc', '-2', '1.5', 'Infinity', '9007199254740992']) assert.equal(getRoundTeamView(teams, { page }).page, 1);
  assert.equal(getRoundTeamView(teams, { page: 999 }).page, 3);
  assert.equal(getRoundTeamView(teams, { page: 3 }).teams.length, 7);
  assert.equal(getRoundTeamView(teams, { status: 'invalid', sort: 'invalid' }).count, 27);
  const duplicates = [teams[0], { ...teams[0], teamId: 20 }, { ...teams[0], teamId: 2 }];
  assert.deepEqual(getRoundTeamView(duplicates).teams.map((team) => team.teamId), [1, 2, 20]);
});

test('검색은 영문 대소문자와 유니코드 호환 문자를 정규화한다', () => {
  assert.equal(getRoundTeamView([{ ...teams[0], name: 'ＦａｉｒＰｌａｙ' }], { query: ' fairplay ' }).count, 1);
});
