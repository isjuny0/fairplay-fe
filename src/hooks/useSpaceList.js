import { useCallback } from 'react';
import { invalidateSpaceList, listSpaces } from '../api/spaces.js';
import useResource from './useResource.js';

export default function useSpaceList(userId) {
  const resource = useResource(listSpaces, [userId]);
  const reload = useCallback(() => {
    invalidateSpaceList();
    resource.reload();
  }, [resource.reload]);
  return { ...resource, reload };
}
