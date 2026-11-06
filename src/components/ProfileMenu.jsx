import { useEffect, useId, useRef, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';

export default function ProfileMenu({ user, busy, onSignOut }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const logout = useRef(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    logout.current?.focus({ preventScroll: true });
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  return (
    <div className="profile-menu" ref={root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          if (!open) setOpen(true);
          else logout.current?.focus();
        }
      }}>
      <button className="header-activity-button profile-menu-trigger" type="button"
        ref={trigger} aria-label="프로필 메뉴" title="프로필 메뉴"
        aria-haspopup="menu" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen((value) => !value)}>
        <UserRound size={20} aria-hidden="true" />
      </button>
      {open && (
        <div className="profile-menu-popover" id={id} role="menu" aria-label="계정 메뉴">
          <p className="profile-menu-name" role="presentation">{user.name}</p>
          <button ref={logout} type="button" role="menuitem" disabled={busy}
            onClick={() => { setOpen(false); onSignOut(); }}>
            <LogOut size={16} aria-hidden="true" /> 로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
