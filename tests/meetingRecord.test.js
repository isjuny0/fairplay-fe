import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMeetingRecord, parseMeetingRecord, meetingRecordTemplate, meetingRecordOverhead } from '../src/lib/meetingRecord.js';
import { meetingInput, meetingDraft, validateMeetingMinute } from '../src/lib/meetingMinutes.js';

test('기본 회의록 템플릿과 빈 문서는 빈 항목으로 저장한다', () => {
  assert.equal(meetingRecordTemplate, '## 안건\n\n## 내용\n\n## 결정사항\n\n');
  for (const record of [meetingRecordTemplate, '', '  \n']) {
    assert.deepEqual(parseMeetingRecord(record), { agenda: '', content: '', decisions: '' });
  }
});

test('기존 항목 원문과 앞뒤 공백·줄바꿈을 통합 편집 후 그대로 복원한다', () => {
  for (const fields of [
    { agenda: ' 안건\n ', content: '\n**본문**\n\n ', decisions: '\r\n결정\r\n' },
    { agenda: '', content: '## 하위 제목\n- [ ] 작업', decisions: '' },
  ]) assert.deepEqual(parseMeetingRecord(formatMeetingRecord(fields)), fields);
  const item = { title: '기존 회의', meetingAt: '2026-11-10T00:00:31.123', agenda: ' 안건\n ', content: '원문', decisions: '', attendees: [] };
  const draft = meetingDraft(item);
  assert.deepEqual(meetingInput({ ...draft, ...parseMeetingRecord(formatMeetingRecord(draft)) }, item), {});
});

test('코드 블록의 구분 제목은 본문으로 보존하고 진짜 항목만 구분한다', () => {
  const fields = { agenda: '````md\n## 내용\n```\n## 결정사항\n````', content: '~~~md\n## 안건\n~~~\n본문', decisions: '결정' };
  assert.deepEqual(parseMeetingRecord(formatMeetingRecord(fields)), fields);
});

test('다른 항목 수정 시 textarea가 정규화한 기존 CRLF는 원문 그대로 보존한다', () => {
  const original = { agenda: '안건\r\n', content: '\r\n 원문\r\n ', decisions: '기존 결정' };
  const record = formatMeetingRecord({ ...original, decisions: '새 결정' }).replace(/\r\n?/g, '\n');
  assert.deepEqual(parseMeetingRecord(record, original), { ...original, decisions: '새 결정' });
});

test('구분 제목이 삭제·중복되거나 제목 위에 본문이 있으면 내용을 버리지 않고 저장을 막는다', () => {
  for (const record of [
    '작성한 회의 내용', meetingRecordTemplate.replace('## 안건', '## 다른 제목'),
    meetingRecordTemplate.replace('## 내용', '## 내용##'),
    meetingRecordTemplate + '\n## 안건\n중복', '기록\n' + meetingRecordTemplate,
  ]) assert.equal(parseMeetingRecord(record), null);
});

test('기존 API 항목별 글자 수 경계와 바뀐 필드만 보내는 계약을 유지한다', () => {
  const fields = { agenda: '가'.repeat(5000), content: '나'.repeat(20000), decisions: '다'.repeat(5000) };
  assert.equal(formatMeetingRecord(fields).length, 30000 + meetingRecordOverhead);
  const form = { title: '회의', meetingAt: '2026-11-10T00:00', attendeeIds: [], ...parseMeetingRecord(formatMeetingRecord(fields)) };
  assert.deepEqual(validateMeetingMinute(form), {});
  for (const key of ['agenda', 'content', 'decisions']) assert.ok(validateMeetingMinute({ ...form, [key]: form[key] + '초과' })[key]);
  const initial = { ...form, attendees: [], meetingAt: '2026-11-10T00:00:31.123' };
  assert.deepEqual(meetingInput({ ...meetingDraft(initial), decisions: '다른 결정' }, initial), { decisions: '다른 결정' });
});
