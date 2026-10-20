import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import Icon from './Icon.jsx';

export default function WorkspaceContextSelect({
  label,
  accessibleLabel,
  icon,
  value,
  options,
  disabled = false,
  onChange,
}) {
  const id = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const optionNodes = useRef([]);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => String(option.value) === String(value)),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex];
  const active = Math.min(activeIndex, options.length - 1);
  const unavailable = disabled || options.length === 0;

  useEffect(() => setOpen(false), [value, disabled]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  useEffect(() => {
    if (open) optionNodes.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const choose = (index) => {
    const option = options[index];
    if (!option) return;
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    if (String(option.value) !== String(value)) onChange(option.value);
  };
  const keyDown = (event) => {
    if (unavailable || event.isComposing) return;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? options.length - 1
            : !open
              ? selectedIndex
              : Math.max(
                  0,
                  Math.min(
                    options.length - 1,
                    index + (event.key === 'ArrowDown' ? 1 : -1),
                  ),
                ),
      );
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active);
      else {
        setActiveIndex(selectedIndex);
        setOpen(true);
      }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const now = Date.now();
      search.current = {
        text:
          (now - search.current.time < 700 ? search.current.text : '') +
          event.key.toLocaleLowerCase(),
        time: now,
      };
      const match = options.findIndex((option) =>
        option.label.toLocaleLowerCase().startsWith(search.current.text),
      );
      if (match >= 0) {
        event.preventDefault();
        setActiveIndex(match);
        setOpen(true);
      }
    }
  };
  return (
    <div className="workspace-context-select" ref={root}>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={accessibleLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={
          open && active >= 0 ? `${id}-option-${active}` : undefined
        }
        className="workspace-context-trigger"
        data-value={String(value)}
        title={selected?.label}
        disabled={unavailable}
        onKeyDown={keyDown}
        onBlur={(event) => {
          if (!root.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onClick={() => {
          setActiveIndex(selectedIndex);
          setOpen((current) => !current);
        }}
      >
        {icon && <Icon name={icon} />}
        <span className="workspace-context-copy">
          {label && <small>{label}</small>}
          <strong>{selected?.label || '불러오는 중…'}</strong>
        </span>
        <ChevronDown
          className="workspace-context-chevron"
          size={15}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={`${id}-list`}
          className="workspace-context-options"
          role="listbox"
          aria-label={accessibleLabel}
        >
          {options.map((option, index) => (
            <div
              key={String(option.value)}
              id={`${id}-option-${index}`}
              ref={(node) => {
                optionNodes.current[index] = node;
              }}
              role="option"
              aria-selected={String(option.value) === String(value)}
              data-value={String(option.value)}
              className={`workspace-context-option ${active === index ? 'is-highlighted' : ''}`}
              onPointerMove={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {String(option.value) === String(value) && (
                <Check size={15} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
