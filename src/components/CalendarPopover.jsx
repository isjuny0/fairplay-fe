import { useLayoutEffect, useRef } from 'react';

// Keep the popup inside the form for keyboard navigation, while the top layer
// lets it overlap the modal's scrolling body without moving any form fields.
export default function CalendarPopover({
  anchorRef,
  width,
  height,
  fitContent = false,
  onClose,
  children,
  ...props
}) {
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const element = panel.current;
    element.showPopover();
    const position = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const popupWidth = Math.min(width || anchor.width, innerWidth - 24);
      element.style.width = `${popupWidth}px`;
      const popupHeight = height || element.scrollHeight + 2;
      const below = Math.max(0, innerHeight - anchor.bottom - 18);
      const above = Math.max(0, anchor.top - 18);
      const upwards = below < Math.min(popupHeight, 280) && above > below;
      const actualHeight = fitContent
        ? popupHeight
        : Math.min(popupHeight, upwards ? above : below);
      element.style.maxHeight = fitContent ? 'none' : `${actualHeight}px`;
      element.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - popupWidth - 12))}px`;
      const top = upwards ? anchor.top - actualHeight - 6 : anchor.bottom + 6;
      element.style.top = `${fitContent ? Math.max(12, Math.min(top, innerHeight - actualHeight - 12)) : top}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(element);
    const outside = (event) => {
      if (
        !element.contains(event.target) &&
        !anchorRef.current?.contains(event.target)
      )
        close.current?.();
    };
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      document.removeEventListener('pointerdown', outside);
      observer.disconnect();
    };
  }, [anchorRef, width, height, fitContent]);
  return (
    <div {...props} ref={panel} popover="manual">
      {children}
    </div>
  );
}
