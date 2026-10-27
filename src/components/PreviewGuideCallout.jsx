import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { guideCalloutPosition } from '../lib/guideCallout.js';

export default function PreviewGuideCallout({ guide, step, stepCount, action, reveal, progress }) {
  const titleId = useId();
  const descriptionId = useId();
  const balloon = useRef(null);
  const [mount, setMount] = useState(null);
  const [position, setPosition] = useState(null);
  const [offscreen, setOffscreen] = useState(false);
  useLayoutEffect(() => {
    let frame;
    let revealTimer;
    let inlineHost;
    let dialogLocateHost;
    let currentTarget;
    let currentProtectedElement;
    let currentDialog;
    let currentMode;
    let fallbackTarget;
    let revealed = false;
    const viewport = () => {
      const visual = window.visualViewport;
      const headerBottom = document.querySelector('body > #root header, .app-header')?.getBoundingClientRect().bottom || 56;
      return { left: visual?.offsetLeft || 0, right: (visual?.offsetLeft || 0) + (visual?.width || innerWidth),
        top: Math.max(visual?.offsetTop || 0, headerBottom), bottom: (visual?.offsetTop || 0) + (visual?.height || innerHeight) };
    };
    const removeHost = () => {
      inlineHost?.remove(); inlineHost = null;
      dialogLocateHost?.remove(); dialogLocateHost = null;
    };
    const visible = (element) => element.getClientRects().length && !element.closest('[hidden]')
      && getComputedStyle(element).visibility === 'visible';
    const measure = () => {
      frame = null;
      const dialog = [...document.querySelectorAll('[role="dialog"]')].at(-1);
      if (dialog && dialog.querySelector('h2')?.textContent !== step.dialogTitle) {
        clearTimeout(revealTimer);
        setMount(null);
        removeHost();
        currentTarget = null;
        return;
      }
      const root = dialog || document;
      const selectors = dialog ? [step.dialogActionTarget, step.dialogTarget] : [step.calloutTarget, step.actionTarget, step.target];
      const target = selectors.filter(Boolean).map((selector) => [...root.querySelectorAll(selector)].find(visible)).find(Boolean);
      if (!target) { clearTimeout(revealTimer); setMount(null); removeHost(); currentTarget = null; return; }
      const bounds = viewport();
      const box = target.getBoundingClientRect();
      const protectedElement = !dialog && step.calloutAvoidClosest ? target.closest(step.calloutAvoidClosest) : null;
      if (protectedElement !== currentProtectedElement) {
        if (currentProtectedElement) resize.unobserve(currentProtectedElement);
        currentProtectedElement = protectedElement;
        if (protectedElement) resize.observe(protectedElement);
      }
      // Put the balloon in dialog flow to preserve scroll and keyboard access.
      // Elsewhere keep fixed-size dashboard widgets and tables unchanged.
      const mode = dialog ? 'inline' : fallbackTarget === target ? 'flow' : 'floating';
      if (target !== currentTarget || dialog !== currentDialog || mode !== currentMode) {
        clearTimeout(revealTimer);
        removeHost();
        if (currentTarget) resize.unobserve(currentTarget);
        currentTarget = target; currentDialog = dialog; currentMode = mode;
        revealed = false;
        setPosition(null);
        if (mode !== 'floating') {
          inlineHost = document.createElement('div');
          inlineHost.dataset.previewGuideCalloutHost = '';
          inlineHost.className = 'preview-guide-callout-host';
          const content = dialog && step.dialogCalloutContainer && dialog.querySelector(step.dialogCalloutContainer);
          const actions = dialog && target.closest('.modal-actions, .heading-actions');
          const table = target.closest('table');
          const pageContainer = !table && !protectedElement ? target.closest('section, article, form') : null;
          const pageAnchor = table ? table.closest('.table-scroll') || table
            : protectedElement || pageContainer || target;
          const anchor = mode === 'flow' ? pageAnchor : actions || (target.matches('summary') ? target.parentElement : target);
          if (content) {
            inlineHost.classList.add('is-content-intro');
            content.prepend(inlineHost);
          } else {
            if (mode === 'flow') inlineHost.classList.add('is-page-intro');
            // Stay inside the detail column instead of inserting a new grid
            // sibling that could push the record into the navigation column.
            if (mode === 'flow' && pageContainer) pageContainer.prepend(inlineHost);
            else anchor.before(inlineHost);
          }
          if (dialog) {
            dialogLocateHost = document.createElement('span');
            dialogLocateHost.className = 'preview-guide-dialog-locate-host';
            const header = dialog.querySelector('.modal-header');
            header?.insertBefore(dialogLocateHost, header.querySelector('button'));
          }
        }
        setMount({ container: inlineHost || document.body, mode, dialog: Boolean(dialog), dialogLocateHost });
        schedule();
        return;
      }
      if (!balloon.current) { schedule(); return; }
      resize.observe(balloon.current);
      resize.observe(target);
      if (mode === 'inline' && !inlineHost.classList.contains('is-content-intro')) {
        const hostBox = inlineHost.getBoundingClientRect();
        const width = balloon.current.getBoundingClientRect().width;
        const center = box.left + box.width / 2;
        const inset = Math.max(0, Math.min(hostBox.width - width, center - hostBox.left - width / 2));
        balloon.current.style.marginLeft = `${inset}px`;
        const bubbleBox = balloon.current.getBoundingClientRect();
        const arrow = Math.max(18, Math.min(width - 28, center - bubbleBox.left - 5));
        balloon.current.style.setProperty('--guide-inline-arrow', `${arrow}px`);
      }
      if (!revealed) {
        revealed = true;
        // Wait for the route's heading focus and entry fade to settle first.
        revealTimer = setTimeout(() => {
          (inlineHost || currentTarget)?.scrollIntoView({ block: 'center',
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
          schedule();
        }, 350);
      }
      const outside = box.bottom <= bounds.top || box.top >= bounds.bottom || box.right <= bounds.left || box.left >= bounds.right;
      if (mode === 'inline') {
        const bodyBox = dialog.querySelector('.modal-body')?.getBoundingClientRect();
        const guideBox = balloon.current.getBoundingClientRect();
        const visibleTop = Math.max(bounds.top, bodyBox?.top || bounds.top);
        const visibleBottom = Math.min(bounds.bottom, bodyBox?.bottom || bounds.bottom);
        setOffscreen(guideBox.top < visibleTop || guideBox.bottom > visibleBottom);
      } else setOffscreen(outside);
      if (mode === 'floating') {
        const size = balloon.current.getBoundingClientRect();
        const protectedRect = protectedElement?.getBoundingClientRect() || box;
        const heading = protectedElement?.matches('tr') ? protectedElement.closest('table')?.tHead : null;
        const headingRect = heading?.getBoundingClientRect();
        // A read target (e.g. the round table) can differ from its confirmation
        // button. Protect both so a balloon below the table cannot block Next.
        const actionRects = step.actionTarget ? [...document.querySelectorAll(step.actionTarget)]
          .filter(visible).map((element) => element.getBoundingClientRect()) : [];
        const avoidRect = [headingRect, ...actionRects].filter(Boolean).reduce((area, rect) => ({
          left: Math.min(area.left, rect.left), right: Math.max(area.right, rect.right),
          top: Math.min(area.top, rect.top), bottom: Math.max(area.bottom, rect.bottom),
        }), protectedRect);
        const next = guideCalloutPosition(box, size, bounds, {
          avoidRect,
          placement: step.calloutPlacement,
        });
        // Keep the instructions readable in page flow when no free space can
        // contain the balloon. Lock until the target or viewport changes so
        // inserting the explanation does not cause a positioning loop.
        if (!next && !outside) { fallbackTarget = target; schedule(); return; }
        setPosition((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const resized = () => { fallbackTarget = null; schedule(); };
    const observer = new MutationObserver((records) => {
      if (records.every(({ target }) => target.closest?.('[data-preview-guide-callout]'))) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['hidden', 'disabled', 'open', 'data-guide', 'class'] });
    const resize = new ResizeObserver(schedule);
    resize.observe(document.documentElement);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', resized);
    window.visualViewport?.addEventListener('resize', resized);
    window.visualViewport?.addEventListener('scroll', schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(revealTimer);
      observer.disconnect(); resize.disconnect(); removeHost();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', resized);
      window.visualViewport?.removeEventListener('resize', resized);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [step]);

  if (!mount) return null;
  const docked = mount.mode === 'floating' && (offscreen || !position);
  return createPortal(<>
    <aside ref={balloon} data-preview-guide-callout="" className={`preview-guide-callout is-${mount.mode}${docked ? ' is-docked' : ''}`}
      aria-labelledby={titleId} aria-describedby={!docked ? descriptionId : undefined}
      data-side={!docked ? position?.side : undefined}
      style={mount.mode === 'floating' && !docked ? { left: position.x, top: position.y, width: position.width, '--guide-arrow': `${position.arrow}px` } : undefined}>
        <div className="preview-guide-callout-heading">
          <span>{guide.step + 1} / {stepCount}</span>
          <strong id={titleId} aria-live="polite">{step.title}</strong>
        </div>
          <p id={descriptionId}>{(mount.dialog ? step.dialogDescription || step.description : step.description)
            .split(/(‘[^’]+’)/g).map((part, index) => part.startsWith('‘')
              ? <strong key={index}>{part}</strong> : part)}</p>
          {progress != null && <p className="preview-guide-callout-progress">팀 진행률 {guide.initialProgress.toFixed(1)}% → {progress.toFixed(1)}%</p>}
          <div className="preview-guide-callout-footer"><span>예시 데이터 · 실제 서버 저장 없음</span>
            {step.id === 'result' && <button type="button" className="primary-button" onClick={action}>{step.returnToGuide ? '팀 홈에서 진행률 확인' : '가이드 마치기'}</button>}
          </div>
    </aside>
    {docked && <button type="button" className="preview-guide-callout-return secondary-button" onClick={reveal}>{guide.step + 1} / {stepCount} · {step.returnToGuide ? '팀 홈에서 진행률 확인' : '안내 위치로 이동'}</button>}
    {mount.dialogLocateHost && offscreen && createPortal(
      <button type="button" className="ghost-button preview-guide-locate" onClick={reveal}>가이드 안내 위치</button>,
      mount.dialogLocateHost)}
    </>, mount.container,
  );
}
