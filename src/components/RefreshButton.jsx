import Icon from './Icon.jsx';
import '../refresh-button.css';

export default function RefreshButton({
  label = '새로고침',
  className = '',
  ...props
}) {
  return (
    <button
      {...props}
      type="button"
      className={`secondary-button refresh-icon-button ${className}`.trim()}
      aria-label={label}
      title={label}
    >
      <Icon name="refresh" />
    </button>
  );
}
