import { useId, useLayoutEffect, useRef, useState } from 'react';
import MarkdownBody from './MarkdownBody.jsx';

const tools = [
  ['heading', '제목'], ['bold', '굵게'], ['list', '목록'], ['ordered', '번호 목록'],
  ['checklist', '체크리스트'], ['quote', '인용'], ['link', '링크'],
  ['table', '표'], ['code', '코드'],
];

export default function MarkdownEditor({ value, onValueChange, labelText, ...inputProps }) {
  const [mode, setMode] = useState('write');
  const panelId = useId();
  const [insertionError, setInsertionError] = useState('');
  const input = useRef(null);
  const invalid = inputProps['aria-invalid'];
  useLayoutEffect(() => {
    if (invalid) setMode('write');
  }, [invalid]);

  const insert = (action) => {
    const element = input.current;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = value.slice(start, end);
    const prefix = { heading: '## ', list: '- ', checklist: '- [ ] ', quote: '> ' }[action];
    let replacement;
    let selectionOffset = 0;
    let selectionLength;
    let replaceStart = start;
    let replaceEnd = end;
    if (prefix || action === 'ordered') {
      replaceStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = value.indexOf('\n', end);
      replaceEnd = lineEnd === -1 ? value.length : lineEnd;
      replacement = (value.slice(replaceStart, replaceEnd) || '내용').split('\n')
        .map((line, index) => `${prefix || `${index + 1}. `}${line}`).join('\n');
      selectionOffset = (prefix || '1. ').length;
      selectionLength = replacement.length - selectionOffset;
    } else if (action === 'bold') {
      replacement = `**${selected || '강조할 내용'}**`;
      selectionOffset = 2;
      selectionLength = replacement.length - 4;
    } else if (action === 'link') {
      replacement = `[${selected || '링크 텍스트'}](https://example.com)`;
      selectionOffset = replacement.indexOf('https://');
      selectionLength = 'https://example.com'.length;
    } else {
      const separator = start > 0 && value[start - 1] !== '\n' ? '\n\n' : '';
      replacement = action === 'table'
        ? `${separator}| 항목 | 내용 |\n| --- | --- |\n| 항목 1 | 내용 1 |\n`
        : `${separator}\`\`\`text\n${selected || '코드'}\n\`\`\`\n`;
      selectionOffset = separator.length + (action === 'code' ? 8 : 2);
      selectionLength = action === 'code' ? (selected || '코드').length : 2;
    }
    const nextValue = value.slice(0, replaceStart) + replacement + value.slice(replaceEnd);
    if (nextValue.length > inputProps.maxLength) {
      setInsertionError(`서식을 넣으면 ${inputProps.maxLength.toLocaleString()}자를 초과합니다. 내용을 줄여 주세요.`);
      return;
    }
    setInsertionError('');
    onValueChange(nextValue);
    const scrollTop = element.scrollTop;
    requestAnimationFrame(() => {
      element.focus({ preventScroll: true });
      element.setSelectionRange(replaceStart + selectionOffset, replaceStart + selectionOffset + selectionLength);
      element.scrollTop = scrollTop;
    });
  };

  return (
    <div className="markdown-editor">
      <div className="markdown-editor-modes" role="group" aria-label="본문 표시 방식">
        <button type="button" aria-pressed={mode === 'write'} aria-controls={`${panelId}-write`} onClick={() => setMode('write')}>작성</button>
        <button type="button" aria-pressed={mode === 'preview'} aria-controls={`${panelId}-preview`} disabled={Boolean(invalid)} onClick={() => setMode('preview')}>미리보기</button>
        <span>마크다운 지원</span>
      </div>
      <div id={`${panelId}-write`} hidden={mode !== 'write'}>
        <div className="markdown-editor-tools" role="group" aria-label="본문 서식 도구">
          {tools.map(([action, label]) => (
            <button key={action} type="button" onClick={() => insert(action)} aria-label={`${label} 서식 삽입`}>{label}</button>
          ))}
        </div>
        <textarea
          {...inputProps}
          ref={input}
          value={value}
          onChange={event => {
            setInsertionError('');
            inputProps.onChange?.(event);
          }}
        />
      </div>
      {mode === 'preview' && (
        <div id={`${panelId}-preview`} className="markdown-editor-preview" role="region" aria-label="본문 미리보기">
          {value.trim() ? <MarkdownBody>{value}</MarkdownBody> : <p className="field-help">본문을 작성하면 이곳에서 표시 형식을 확인할 수 있습니다.</p>}
        </div>
      )}
      {insertionError && <p className="field-error" role="alert">{insertionError}</p>}
      <details className="markdown-help">
        <summary>마크다운 작성 도움말</summary>
        <p>서식 버튼을 누르거나 직접 입력하세요. 일반 텍스트도 사용할 수 있습니다.</p>
        <dl>
          <div><dt>제목</dt><dd><code>## 제목</code></dd></div>
          <div><dt>굵게</dt><dd><code>**중요한 내용**</code></dd></div>
          <div><dt>목록</dt><dd><code>- 항목</code></dd></div>
          <div><dt>체크리스트</dt><dd><code>- [ ] 확인할 내용</code></dd></div>
          <div><dt>링크</dt><dd><code>[이름](https://example.com)</code></dd></div>
        </dl>
        <p>체크리스트는 문서 표시용이며 작업 상태를 변경하지 않습니다. HTML·이미지·임베드는 표시하지 않습니다.</p>
      </details>
    </div>
  );
}

MarkdownEditor.compositeField = true;
