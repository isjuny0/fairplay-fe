import { createContext } from 'react';

// Workspace data is shared with the header without repeating API requests.
export const HeaderContext = createContext(null);
