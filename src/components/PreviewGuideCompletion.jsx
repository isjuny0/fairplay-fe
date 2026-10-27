import { useEffect, useId, useRef } from 'react';
import { ArrowRight, CheckCircle2, X } from 'lucide-react';

export default function PreviewGuideCompletion({ scenario, next, busy, error, onNext, onList, onExplore, onDismiss }) {
  const titleId = useId();
  const panel = useRef(null);
  const title = useRef(null);
  useEffect(() => {
    // Final confirmations can close a dialog or finish far down the page.
    // Reveal the completion actions after those focus/scroll updates settle.
    const timeout = setTimeout(() => {
      if (document.querySelector('[role="dialog"]')) return;
      panel.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      title.current?.focus({ preventScroll: true });
    }, 350);
    return () => clearTimeout(timeout);
  }, []);
  return <section ref={panel} className="preview-guide-completion" aria-labelledby={titleId} aria-busy={busy}>
    <div className="preview-guide-completion-heading">
      <CheckCircle2 size={19} aria-hidden="true" />
      <div>
        <span className="preview-guide-completion-label">사용자 가이드 완료</span>
        <h2 id={titleId} ref={title} tabIndex={-1}>{scenario?.title || '사용자 가이드'} 완료</h2>
      </div>
      <button className="icon-button" aria-label="가이드 완료 안내 닫기" disabled={busy} onClick={onDismiss}><X size={16} /></button>
    </div>
    {next ? <p className="preview-guide-next-purpose">다음은 <strong>{next.title}</strong>입니다. {next.purpose}</p>
      : <p className="preview-guide-next-purpose">이 역할의 마지막 가이드입니다. 목록에서 다른 흐름을 선택하거나 자유롭게 둘러보세요.</p>}
    {error && <p className="notice" role="alert">{error}</p>}
    <div className="preview-guide-completion-actions">
      {next && <button type="button" className="primary-button" disabled={busy} onClick={onNext}>
        다음 가이드: {next.title}<ArrowRight size={15} aria-hidden="true" />
      </button>}
      <button type="button" className={next ? 'secondary-button' : 'primary-button'} disabled={busy} onClick={onList}>가이드 목록</button>
      <button type="button" className="ghost-button" disabled={busy} onClick={onExplore}>자유 탐색</button>
    </div>
    {next && <p className="preview-guide-completion-note">다음 가이드는 새 예시 데이터로 첫 단계부터 시작합니다.</p>}
  </section>;
}
