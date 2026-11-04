import { QueryClientProvider } from '@tanstack/react-query';
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { renderHook as renderTestingHook, type RenderHookOptions } from '@testing-library/react';
import { createElement, type FC, type PropsWithChildren, type ReactNode } from 'react';

import { createQueryClient } from '../api/queryClient';

const createTestRouter = (initialPath: string) => {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/home',
  });
  const routeTree = rootRoute.addChildren([indexRoute, homeRoute]);

  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
};

type RenderHookOptionsWithProviders<Props> = Omit<RenderHookOptions<Props>, 'wrapper'> & {
  readonly initialPath?: string;
  readonly wrapper?: FC<PropsWithChildren>;
};

const renderInnerWrapper = (
  InnerWrapper: FC<PropsWithChildren> | undefined,
  children: ReactNode,
) => {
  if (InnerWrapper === undefined) {
    return children;
  }

  return createElement(InnerWrapper, undefined, children);
};

export const renderHook = <Result, Props>(
  callback: (initialProps: Props) => Result,
  options: RenderHookOptionsWithProviders<Props> = {},
) => {
  const { initialPath = '/', wrapper: InnerWrapper, ...renderHookOptions } = options;
  const router = createTestRouter(initialPath);
  const queryClient = createQueryClient();

  const Wrapper: FC<PropsWithChildren> = ({ children }) => {
    const content = renderInnerWrapper(InnerWrapper, children);
    const queryProvider = createElement(QueryClientProvider, { client: queryClient }, content);
    const routerProviderProps = Object.assign({ router }, { children: queryProvider });

    return createElement(RouterContextProvider, routerProviderProps);
  };

  return {
    router,
    queryClient,
    ...renderTestingHook(callback, {
      ...renderHookOptions,
      wrapper: Wrapper,
    }),
  };
};
