import { useEffect, useState } from 'react';

export const useWindowFocus = () => {
  const [isWindowFocused, setIsWindowFocused] = useState(
    () => typeof document !== 'undefined' && document.hasFocus(),
  );

  useEffect(() => {
    const updateFocus = () => setIsWindowFocused(document.hasFocus());

    window.addEventListener('focus', updateFocus);
    window.addEventListener('blur', updateFocus);
    document.addEventListener('visibilitychange', updateFocus);

    return () => {
      window.removeEventListener('focus', updateFocus);
      window.removeEventListener('blur', updateFocus);
      document.removeEventListener('visibilitychange', updateFocus);
    };
  }, []);

  return isWindowFocused;
};