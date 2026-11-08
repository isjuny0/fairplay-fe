// Keep every landing placement on the same screenshot revision, including <source>.
// Bump this value when recapturing product screenshots so browsers do not reuse old images.
export const LANDING_SCREEN_VERSION = 'vivid-20261108-3';

export function landingScreenUrl(name, viewport = 'desktop') {
  return `/landing/${name}-${viewport}.jpg?v=${LANDING_SCREEN_VERSION}`;
}
