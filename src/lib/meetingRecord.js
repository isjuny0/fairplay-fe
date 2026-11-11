export const meetingRecordSections = [
  ['agenda', '안건'], ['content', '내용'], ['decisions', '결정사항'],
];

export const formatMeetingRecord = (fields = {}) => meetingRecordSections
  .map(([key, label], index) => {
    const separator = index && fields[meetingRecordSections[index - 1][0]] ? '\n\n' : '';
    return `${separator}## ${label}\n\n${fields[key] || ''}`;
  }).join('');

export const meetingRecordTemplate = formatMeetingRecord();
export const meetingRecordOverhead = formatMeetingRecord({ agenda: 'a', content: 'b', decisions: 'c' }).length - 3;
export const meetingRecordFormatError = '## 안건, ## 내용, ## 결정사항 구분 제목을 각각 하나씩 유지해 주세요. 제목 위의 내용도 해당 항목 아래에 작성해 주세요.';

// Only section headings outside fenced code blocks separate the API fields.
export function parseMeetingRecord(record, original = null) {
  if (!record.trim()) return { agenda: '', content: '', decisions: '' };
  const headings = [];
  let offset = 0, fence = null;
  for (const line of record.match(/[^\n]*(?:\n|$)/g)) {
    const text = line.replace(/\r?\n$/, '');
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
    } else if (marker) {
      fence = marker[1];
    } else {
      const heading = /^ {0,3}##[ \t]+(안건|내용|논의 내용|결정사항)(?:[ \t]+#+)?[ \t]*$/.exec(text);
      if (heading) headings.push({ key: heading[1] === '안건' ? 'agenda' : heading[1] === '결정사항' ? 'decisions' : 'content', start: offset, body: offset + line.length });
    }
    offset += line.length;
  }
  if (headings.length !== 3 || new Set(headings.map(item => item.key)).size !== 3 || record.slice(0, headings[0].start).trim()) return null;
  return Object.fromEntries(headings.map((heading, index) => {
    let value = record.slice(heading.body, headings[index + 1]?.start ?? record.length);
    // Remove the template's separators, preserving the original field's whitespace.
    value = value.replace(/^\r?\n/, '');
    if (index < headings.length - 1) value = value.replace(/\r?\n\r?\n$/, '');
    const previous = original?.[heading.key];
    // Textareas normalize CR/CRLF. Do not turn that into an unrelated PATCH edit.
    if (typeof previous === 'string' && previous.replace(/\r\n?/g, '\n') === value.replace(/\r\n?/g, '\n')) value = previous;
    return [heading.key, value];
  }));
}
