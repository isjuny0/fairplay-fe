import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router';

// Animate the committed screen once, including lazy-loaded routes. Never hide
// content while waiting, remount forms, or delay a request/navigation to animate.
export default function useScreenMotion() {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const view = params.get('view') || '';
  const teamId = params.get('teamId') || '';
  useLayoutEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    let animation;
    let observer;
    let timeout;
    let finished = false;
    const revealScreen = () => {
      if (finished || preference.matches) return;
      const main = document.querySelector('main');
      const title = main?.querySelector('h1');
      if (!title?.getClientRects().length || main.querySelector('.loading-placeholder')
        || typeof main.animate !== 'function') return;
      finished = true;
      // Opacity preserves the containing block of fixed dialogs and tooltips.
      animation = main.animate([{ opacity: 0.12 }, { opacity: 1 }], {
        duration: 320,
        easing: 'cubic-bezier(.2, .7, .3, 1)',
      });
      observer?.disconnect();
      clearTimeout(timeout);
    };
    const stopMotion = () => {
      if (!preference.matches) return;
      finished = true;
      animation?.cancel();
      observer?.disconnect();
      clearTimeout(timeout);
    };
    observer = new MutationObserver(revealScreen);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style'] });
    timeout = setTimeout(() => observer.disconnect(), 5000);
    preference.addEventListener('change', stopMotion);
    revealScreen();
    return () => {
      animation?.cancel();
      observer.disconnect();
      clearTimeout(timeout);
      preference.removeEventListener('change', stopMotion);
    };
    // Search/filter/page changes update content without restarting the screen.
  }, [pathname, view, teamId]);

  // Observe selected controls, not data updates. This also supports panels that
  // reuse the same DOM node (date pickers, Markdown modes, evaluation targets).
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Map();
    const pendingPanels = new Map();
    const cancelPanel = (panel) => {
      animations.get(panel)?.cancel();
      animations.delete(panel);
      pendingPanels.get(panel)?.();
      pendingPanels.delete(panel);
    };
    const cancelAnimations = () => {
      for (const panel of new Set([...animations.keys(), ...pendingPanels.keys()])) cancelPanel(panel);
    };
    const revealPanel = (panel) => {
      cancelPanel(panel);
      let readyObserver;
      let timeout;
      const cleanup = () => {
        readyObserver?.disconnect();
        clearTimeout(timeout);
        pendingPanels.delete(panel);
      };
      const reveal = () => {
        if (preference.matches || !panel.getClientRects().length) { cleanup(); return; }
        if (panel.querySelector('.loading-placeholder')) return;
        cleanup();
        const animation = panel.animate([{ opacity: .12 }, { opacity: 1 }], {
          duration: 280,
          easing: 'cubic-bezier(.2, .7, .3, 1)',
        });
        animations.set(panel, animation);
        animation.onfinish = () => { if (animations.get(panel) === animation) animations.delete(panel); };
      };
      readyObserver = new MutationObserver(reveal);
      readyObserver.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style'] });
      timeout = setTimeout(cleanup, 5000);
      pendingPanels.set(panel, cleanup);
      reveal();
    };
    const stopMotion = () => { if (preference.matches) cancelAnimations(); };
    const observer = new MutationObserver((records) => {
      if (preference.matches) return;
      const panels = new Set();
      for (const { target } of records) {
        const selected = target.getAttribute('role') === 'tab'
          ? target.getAttribute('aria-selected') === 'true'
          : target.getAttribute('aria-pressed') === 'true';
        if (!selected) continue;
        for (const id of (target.getAttribute('aria-controls') || '').split(/\s+/)) {
          const panel = document.getElementById(id);
          if (panel?.getClientRects().length && typeof panel.animate === 'function') panels.add(panel);
        }
      }
      for (const panel of new Set([...animations.keys(), ...pendingPanels.keys()])) {
        if (!panel.getClientRects().length) cancelPanel(panel);
      }
      for (const panel of panels) revealPanel(panel);
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-pressed'] });
    preference.addEventListener('change', stopMotion);
    return () => {
      observer.disconnect();
      cancelAnimations();
      preference.removeEventListener('change', stopMotion);
    };
  }, []);
}
