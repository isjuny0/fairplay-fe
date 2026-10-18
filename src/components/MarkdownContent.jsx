import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const allowedElements = [
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'del',
  'ul', 'ol', 'li', 'blockquote', 'a', 'pre', 'code', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input',
];

const components = {
  h1: ({ children }) => <h3 className="markdown-heading-major">{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  h4: ({ children }) => <h5>{children}</h5>,
  h5: ({ children }) => <h6>{children}</h6>,
  h6: ({ children }) => <h6>{children}</h6>,
  a: ({ href, children }) => href
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  table: ({ children }) => (
    <div className="markdown-table-scroll" role="region" aria-label="문서 표" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
  pre: ({ children }) => <pre tabIndex={0} aria-label="코드 블록">{children}</pre>,
  input: ({ checked }) => <input type="checkbox" checked={Boolean(checked)} disabled />,
};

export default function MarkdownContent({ children }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      allowedElements={allowedElements}
      skipHtml
      urlTransform={url => /^(https?:\/\/|mailto:)/i.test(url) ? url : ''}
      components={components}
    >
      {children}
    </Markdown>
  );
}
