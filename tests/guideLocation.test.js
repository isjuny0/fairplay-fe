import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideLocationMatches } from '../src/lib/guideLocation.js';

const location = (path) => {
  const url = new URL(path, 'https://preview.invalid');
  return { pathname: url.pathname, search: url.search };
};

test('평가 시작 가이드는 동료 평가 결과 탭에서 복귀가 필요하다', () => {
  const step = { path: '/preview/spaces/1/rounds' };
  assert.equal(guideLocationMatches(step, location(`${step.path}?tab=peer-responses`)), false);
  assert.equal(guideLocationMatches(step, location(step.path)), true);
});

test('팀 목록 및 상세 안내는 선택 팀과 목록 필터를 구분한다', () => {
  const path = '/preview/spaces/1/dashboard';
  assert.equal(guideLocationMatches({ path }, location(`${path}?teamId=2`)), false);
  assert.equal(guideLocationMatches({ path }, location(`${path}?teamFilter=stale`)), false);
  assert.equal(guideLocationMatches({ path: `${path}?teamId=1` }, location(`${path}?teamId=2`)), false);
  assert.equal(guideLocationMatches({ path: `${path}?teamId=1` }, location(`${path}?teamId=1`)), true);
});

test('수행 상세의 결과 탭·다른 작업·작업 필터는 모두 복원 대상이다', () => {
  const path = '/preview/spaces/1/manager/teams/1/members/member-1';
  const step = { path: `${path}?taskId=101` };
  for (const query of ['taskId=102', 'taskId=101&tab=evaluations', 'taskId=101&status=IN_PROGRESS']) {
    assert.equal(guideLocationMatches(step, location(`${path}?${query}`)), false);
  }
  assert.equal(guideLocationMatches(step, location(step.path)), true);
});

test('평가 회차 및 리포트 검토 팀도 현재 단계와 일치해야 한다', () => {
  for (const [path, expected, other] of [
    ['/preview/spaces/1/teams/1/peer-evaluations', 'roundId=12', 'roundId=11'],
    ['/preview/spaces/1/reports', 'teamId=1', 'teamId=2'],
  ]) {
    assert.equal(guideLocationMatches({ path: `${path}?${expected}` }, location(`${path}?${other}`)), false);
    assert.equal(guideLocationMatches({ path: `${path}?${expected}` }, location(`${path}?${expected}`)), true);
  }
});

test('작업 목록을 숨기는 필터는 복원하되 작업 상세의 이전 보기 방식은 허용한다', () => {
  const path = '/preview/spaces/1/teams/1/tasks';
  const step = { path: `${path}?view=list&mine=1` };
  assert.equal(guideLocationMatches(step, location(`${step.path}&q=없는작업`)), false);
  assert.equal(guideLocationMatches(step, location(`${path}?mine=1&view=list`)), true);
  assert.equal(guideLocationMatches({ path: `${path}/109` }, location(`${path}/109?view=board`)), true);
  assert.equal(guideLocationMatches(step, location('/preview/main')), false);
});
