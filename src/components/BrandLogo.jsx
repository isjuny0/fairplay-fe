import '../brand-logo.css';

export default function BrandLogo({ symbolOnly = false, inverse = false, decorative = false, className = '' }) {
  return (
    <img
      className={`brand-logo${symbolOnly ? ' brand-logo--symbol' : ''}${inverse ? ' brand-logo--inverse' : ''} ${className}`}
      src={symbolOnly ? '/branding/fairplay-symbol.webp' : '/branding/fairplay-logo.webp'}
      width={symbolOnly ? 256 : 530}
      height={symbolOnly ? 256 : 160}
      alt={decorative ? '' : 'Fairplay'}
      draggable="false"
    />
  );
}
