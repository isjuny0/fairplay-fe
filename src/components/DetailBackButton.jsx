import '../detail-back-button.css';

export default function DetailBackButton({ children, onClick }) {
  return (
    <button type="button" className="ghost-button detail-back-button" onClick={onClick}>
      <span>←</span> {children}
    </button>
  );
}
