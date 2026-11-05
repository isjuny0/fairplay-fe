import { useEffect, useState } from 'react';

export default function MobileDisclosure({ summary, children, className = '', media = '(max-width: 720px)' }) {
  const [mobile, setMobile] = useState(() => window.matchMedia(media).matches);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(media);
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [media]);
  return <details className={`mobile-disclosure ${className}`} open={!mobile || expanded} onToggle={event => {
    if (mobile) setExpanded(event.currentTarget.open);
  }}>
    <summary>{summary}</summary>
    {children}
  </details>;
}
