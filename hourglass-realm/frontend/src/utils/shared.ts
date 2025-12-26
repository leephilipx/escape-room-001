import { APP_BASE_PATH } from './constants'

export const resolvePathwithBase = (path: string): string => {
  const domain = window.location.origin;
  const basePath = APP_BASE_PATH.replace(/\/+$/, ''); // Remove trailing slashes
  return `${domain}${basePath}/${path.replace(/^\/+/, '')}`; // Remove leading slashes
};