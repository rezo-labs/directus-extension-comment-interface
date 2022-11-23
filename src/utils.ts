import { User } from '@directus/shared/types';

export function getRootPath(): string {
  const path = window.location.pathname;
  const parts = path.split('/');
  const adminIndex = parts.indexOf('admin');
  const rootPath = parts.slice(0, adminIndex).join('/') + '/';
  return rootPath;
}

export function userName(user: Partial<User>, t: any): string {
  if (!user) {
    return t('unknown_user') as string;
  }

  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }

  if (user.first_name) {
    return user.first_name;
  }

  if (user.email) {
    return user.email;
  }

  return t('unknown_user') as string;
}

export function addQueryToPath(path: string, query: Record<string, string>): string {
  const queryParams = new URLSearchParams(path.split('?')[1] || '');

  for (const [key, value] of Object.entries(query)) {
    queryParams.set(key, value);
  }

  return path.split('?')[0] + '?' + queryParams;
}

export function getToken(api): string | null {
  return api.defaults.headers.common['Authorization']?.split(' ')[1] || null;
}

export function addTokenToURL(url: string, api: any): string {
  const accessToken = getToken(api);
  if (!accessToken) return url;

  return addQueryToPath(url, { access_token: accessToken });
}
