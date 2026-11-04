import { useEffect } from 'react';

const selector = '.table-scroll, .collection-table-scroll, .task-table-scroll, .task-timeline-scroll';

// Match the hint to the actual scrollable area, including asynchronously loaded tables.
export default function ScrollAffordances() {
  useEffect(() => {
    const regions = new Set();
    let frame;
    const update = (element) => {
      element.dataset.horizontalOverflow = String(element.scrollWidth > element.clientWidth + 2);
      element.dataset.scrollEnd = String(element.scrollLeft + element.clientWidth >= element.scrollWidth - 2);
    };
    const resize = new ResizeObserver(entries => entries.forEach(({ target }) => update(target)));
    const discover = () => {
      for (const region of regions) if (!region.isConnected) { resize.unobserve(region); regions.delete(region); }
      for (const region of document.querySelectorAll(selector)) {
        if (!regions.has(region)) { regions.add(region); resize.observe(region); }
        update(region);
      }
    };
    const mutation = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(discover); });
    mutation.observe(document.body, { childList: true, subtree: true });
    const scroll = (event) => { if (regions.has(event.target)) update(event.target); };
    document.addEventListener('scroll', scroll, true);
    discover();
    return () => { mutation.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); document.removeEventListener('scroll', scroll, true); };
  }, []);
  return null;
}
