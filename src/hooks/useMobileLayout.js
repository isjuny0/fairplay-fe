import { useEffect, useState } from 'react';

export default function useMobileLayout(query = '(max-width: 600px)') {
  const [mobile, setMobile] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return mobile;
}
