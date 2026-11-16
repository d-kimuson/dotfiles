import { hc } from 'hono/client';

import type { RouteType } from '../../../server/routes';
// マルチパッケージの場合: import type { RouteType } from '<pkg-name-backend>/types';

export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;

  constructor(status: number, statusText: string) {
    super(`HttpError: ${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
  }
}

const customFetch: typeof fetch = async (...args) => {
  const response = await fetch(...args);

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText);
  }

  return response;
};

export const honoClient = hc<RouteType>('/', {
  fetch: customFetch,
});
