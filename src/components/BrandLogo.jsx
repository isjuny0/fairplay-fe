import '../brand-logo.css';

export default function BrandLogo({ symbolOnly = false, inverse = false, decorative = false, className = '' }) {
  return (
    <img
      className={`brand-logo${symbolOnly ? ' brand-logo--symbol' : ''}${inverse ? ' brand-logo--inverse' : ''} ${className}`}
      src={symbolOnly ? '/branding/fairplay-symbol.webp' : '/branding/fairplay-logo.webp'}
      width={symbolOnly ? 256 : 1060}
      height={symbolOnly ? 256 : 255}
      alt={decorative ? '' : 'Fairplay'}
      draggable="false"
    />
  );
}
