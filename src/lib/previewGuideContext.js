import { createContext, useContext } from 'react';

export const PreviewGuideContext = createContext(null);
export const usePreviewGuide = () => useContext(PreviewGuideContext);
