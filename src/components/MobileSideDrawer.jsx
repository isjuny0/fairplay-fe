import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Keep desktop navigation in place; mobile navigation sits above the page.
export default function MobileSideDrawer({ open, onClose, triggerRef, title, variant = 'workspace', children }) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const update = () => { setMobile(query.matches); close.current(); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobile || !open) return;
    const root = document.getElementById('root');
    const wasInert = root.inert;
    const overflow = document.body.style.overflow;
    root.inert = true;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => {
      // Flush the previously inert/hidden layer before moving focus into it.
      panel.current?.getBoundingClientRect();
      panel.current?.querySelector('button')?.focus({ preventScroll: true });
    });
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!panel.current.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      root.inert = wasInert;
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKey);
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [mobile, open, triggerRef]);
  if (!mobile) return children;
  return createPortal(
    <div className={`mobile-drawer-layer ${open ? 'is-open' : ''}`} inert={!open ? true : undefined} aria-hidden={!open || undefined}>
      <div className="mobile-drawer-backdrop" onClick={onClose} />
      <section ref={panel} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label={title}
        onTransitionEnd={event => {
          if (event.target === panel.current && open && !panel.current.contains(document.activeElement)) panel.current.querySelector('button')?.focus({ preventScroll: true });
        }}
        className={`mobile-side-drawer ${variant === 'workspace' ? 'workspace-sidebar is-mobile-open' : 'space-directory-sidebar is-open'}`}>
        <header className="mobile-drawer-heading"><strong>{title}</strong><button type="button" className="secondary-button" aria-label="메뉴 닫기" onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
        {children}
      </section>
    </div>, document.body,
  );
}
