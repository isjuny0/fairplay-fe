import { useRef } from 'react';
import '../space-operation.css';

export default function SectionTabs({ id, label, tabs, activeTab, onSelect }) {
  const buttons = useRef([]);
  return (
    <div className="space-operation-tabs" role="tablist" aria-label={label}>
      {tabs.map(([key, title], index) => (
        <button key={key} ref={(element) => { buttons.current[index] = element; }}
          type="button" role="tab" id={`${id}-${key}-tab`}
          aria-selected={activeTab === key} aria-controls={`${id}-${key}-panel`}
          tabIndex={activeTab === key ? 0 : -1}
          onClick={() => onSelect(key)}
          onKeyDown={(event) => {
            let nextIndex;
            if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
            if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            if (nextIndex === undefined) return;
            event.preventDefault();
            onSelect(tabs[nextIndex][0]);
            buttons.current[nextIndex]?.focus();
          }}>
          {title}
        </button>
      ))}
    </div>
  );
}
