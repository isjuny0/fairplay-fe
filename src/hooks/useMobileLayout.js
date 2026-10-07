import { useEffect, useState } from 'react';

export default function useMobileLayout() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 600px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 600px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return mobile;
}
