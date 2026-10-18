import { lazy, Suspense } from 'react';

const MarkdownContent = lazy(() => import('./MarkdownContent.jsx'));

export default function MarkdownBody({ children }) {
  return (
    <div className="markdown-body">
      <Suspense fallback={<p role="status">문서 표시 중…</p>}>
        <MarkdownContent>{children || ''}</MarkdownContent>
      </Suspense>
    </div>
  );
}
