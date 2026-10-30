import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'react-router';
import useAppNavigate from '../hooks/useAppNavigate.js';

export default function PersonalWorkBackButton() {
  const navigate = useAppNavigate();
  const { key } = useLocation();
  return <button
    type="button"
    className="secondary-button personal-work-back-button"
    onClick={() => navigate(!key || key === 'default' ? '/main' : -1)}
  ><ArrowLeft size={17} /> 뒤로가기</button>;
}
