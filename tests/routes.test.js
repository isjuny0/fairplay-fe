import test from 'node:test';
import assert from 'node:assert/strict';
import { loginReturnPath, parseRouteId } from '../src/lib/routes.js';

test('주소 ID는 양의 안전한 정수만 허용한다', () => {
  assert.equal(parseRouteId('12'), 12);
  for (const value of [
    undefined,
    null,
    '',
    '0',
    '-1',
    '1.5',
    'abc',
    '1e3',
    '9007199254740992',
    '1/2',
  ])
    assert.equal(parseRouteId(value), null);
});

test('로그인 후 복귀 주소는 내부 경로만 허용한다', () => {
  assert.equal(
    loginReturnPath('/spaces/1/teams/2/tasks/3?mine=1'),
    '/spaces/1/teams/2/tasks/3?mine=1',
  );
  for (const value of [
    null,
    undefined,
    123,
    'https://example.com',
    '//example.com',
    '/\\example.com',
    'javascript:alert(1)',
  ])
    assert.equal(loginReturnPath(value), '/main');
});
