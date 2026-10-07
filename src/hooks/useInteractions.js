import { createContext, useContext, useEffect, useId } from 'react';

export const InteractionContext = createContext(null);

export function useInteractions() {
  return useContext(InteractionContext);
}

export function useUnsavedChanges(hasChanges) {
  const formId = useId();
  const { registerChanges } = useInteractions();
  useEffect(() => {
    registerChanges(formId, hasChanges);
    return () => registerChanges(formId, false);
  }, [formId, hasChanges, registerChanges]);
}
