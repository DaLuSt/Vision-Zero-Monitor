import { lazy, type ComponentType } from 'react';

/** React.lazy for a module's named export, keeping the component's prop types. */
export function lazyPage<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lazy(async () => ({ default: (await load())[name] as M[K] & ComponentType<any> }));
}
