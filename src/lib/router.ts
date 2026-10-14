import { useEffect, useState } from 'react';

export type Route =
  | { page: 'overview' }
  | { page: 'countries' }
  | { page: 'country'; geo: string }
  | { page: 'explorer' }
  | { page: 'charts'; query: string }
  | { page: 'methodology' }
  | { page: 'sources' }
  | { page: 'notfound' };

export function parseHash(hash: string): Route {
  const [rawPath, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const path = rawPath.replace(/\/$/, '');
  const [first, second] = path.split('/');
  switch (first) {
    case '':
      return { page: 'overview' };
    case 'countries':
      return second ? { page: 'country', geo: second.toUpperCase() } : { page: 'countries' };
    case 'explorer':
      return { page: 'explorer' };
    case 'charts':
      return { page: 'charts', query };
    case 'methodology':
      return { page: 'methodology' };
    case 'sources':
      return { page: 'sources' };
    default:
      return { page: 'notfound' };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo?.({ top: 0 });
      // Move focus to the main landmark so keyboard and screen reader users land on the new page.
      document.getElementById('main')?.focus();
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
