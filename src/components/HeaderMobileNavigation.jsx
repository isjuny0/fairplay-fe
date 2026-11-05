import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { MobileNavigationSlotContext } from './HeaderContext.js';

export default function HeaderMobileNavigation({ children }) {
  const target = useContext(MobileNavigationSlotContext);
  return target ? createPortal(children, target) : null;
}
