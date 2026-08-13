// hooks/useTrafficLightConfig.ts
import { useMemo } from 'react';
import { isMacos } from '@/hooks/runtime';

export const useTrafficLightConfig = (isSidebarOpen: boolean) => {
  const macos = isMacos();
  const needsTrafficLightOffset = useMemo(() => {
    return macos && !isSidebarOpen;
  }, [macos, isSidebarOpen]);

  return {
    isMacos: macos,
    needsTrafficLightOffset,
  };
};
