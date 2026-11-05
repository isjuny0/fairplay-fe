import { useEffect } from 'react';

// Safari resizes the visual viewport without resizing the layout viewport.
export default function MobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const field = document.activeElement;
        const editing = field?.matches('textarea, input:not([type=checkbox]):not([type=radio]):not([type=button])');
        const keyboard = window.innerWidth <= 720 && editing && window.innerHeight - viewport.height > 140;
        document.body.classList.toggle('has-screen-keyboard', Boolean(keyboard));
        document.documentElement.style.setProperty('--mobile-available-height', `${viewport.height}px`);
        document.documentElement.style.setProperty('--mobile-viewport-top', `${viewport.offsetTop}px`);
        if (keyboard) field.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      });
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      document.body.classList.remove('has-screen-keyboard');
      document.documentElement.style.removeProperty('--mobile-available-height');
      document.documentElement.style.removeProperty('--mobile-viewport-top');
    };
  }, []);
  return null;
}
