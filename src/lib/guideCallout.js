const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

// Keep both the control and any related information clear of the balloon.
export function guideCalloutPosition(anchor, size, viewport, { avoidRect = anchor, placement = 'auto' } = {}) {
  const gap = 14;
  const left = viewport.left + 12, top = viewport.top + 12;
  const right = viewport.right - 12, bottom = viewport.bottom - 12;
  const width = Math.min(size.width, right - left);
  const height = size.height;
  // A clipped height would claim a balloon fits while its text overflows.
  if (width <= 0 || height <= 0 || height > bottom - top) return null;
  const centerX = (anchor.left + anchor.right) / 2;
  const centerY = (anchor.top + anchor.bottom) / 2;
  const vertical = clamp(centerY - height / 2, top, bottom - height);
  const horizontal = clamp(placement === 'vertical' ? Math.max(anchor.left, avoidRect.left) : centerX - width / 2, left, right - width);
  const protectedArea = {
    left: Math.min(anchor.left, avoidRect.left), right: Math.max(anchor.right, avoidRect.right),
    top: Math.min(anchor.top, avoidRect.top), bottom: Math.max(anchor.bottom, avoidRect.bottom),
  };
  const candidates = [
    { side: 'right', x: protectedArea.right + gap, y: vertical },
    { side: 'left', x: protectedArea.left - gap - width, y: vertical },
    { side: 'bottom', x: horizontal, y: protectedArea.bottom + gap },
    { side: 'top', x: horizontal, y: protectedArea.top - gap - height },
  ];
  const ordered = placement === 'vertical' ? [candidates[3], candidates[2]] : candidates;
  const position = ordered.find(({ x, y }) => x >= left && y >= top && x + width <= right && y + height <= bottom);
  if (!position) return null;
  return { ...position, width, arrow: position.side === 'left' || position.side === 'right'
    ? clamp(centerY - position.y, 18, height - 18) : clamp(centerX - position.x, 18, width - 18) };
}
