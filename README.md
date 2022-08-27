# `@timwheeler/monkey-fetch`

A monkey-patch library for the native JavaScript `fetch` API, inspired
by [`fetch-intercept`](https://www.npmjs.com/package/fetch-intercept).

Common use-cases:
- Intercept `fetch` requests
  - Add an `Authorization` header to all `fetch` requests
  - Add other `headers` (such as `Content-Type`) to all `fetch` requests
- Fetch a new token pair when an access token expires
- Retry requests with expired access tokens
- and more!

## Getting Started

### Installation

#### `npm`

```bash
npm install @timwheeler/monkey-fetch
```

#### `yarn`

```bash
yarn add @timwheeler/monkey-fetch
```

### Configuration

```typescript
import { MonkeyFetch } from '@timwheeler/monkey-fetch';

const monkeyFetch = new MonkeyFetch();

// all configuration methods are optional, only use what you need
monkeyFetch.configure({
  request: (resource: RequestInfo | URL, options: RequestInit): Promise<[(RequestInfo | URL), RequestInit]> => {
    // add custom request handler logic
    return Promise.resolve([resource, options]);
  },
  requestError: (error: Error) => {
    // add custom request error handler logic
    return Promise.reject(error);
  },
  response: (response: Response) => {
    // add custom response handler logic
    return Promise.resolve(response);
  },
  responseError: (response: IMonkeyFetchResponse) => {
    // add custom response error handler logic
    return Promise.reject(response);
  },
});
```

### Example
This example uses the `monkey-fetch` library to:
- Add an access token to the `Authorization` header of all requests
- Add a `Content-Type: application/json` header to all requests that include a `body`
- Refresh access & refresh tokens upon receiving an `HTTP 401 Unauthorized` response then retry the original request

Of course your implementation and use-case may be quite different so adjust accordingly.

```typescript
import { MonkeyFetch } from '@timwheeler/monkey-fetch';

const monkeyFetch = new MonkeyFetch();

monkeyFetch.configure({
  request: (resource: RequestInfo | URL, options: RequestInit): Promise<[(RequestInfo | URL), RequestInit]> => {

    const newOptions: RequestInit = { ...options };

    // add json content-type to all reqs with a payload
    if (options?.body) {
      newOptions.headers = {
        ...newOptions.headers,
        'Content-Type': 'application/json',
      }
    }

    // fetch accessToken from local store
    const { accessToken } = localAuthStore();

    // your refresh token route
    const refreshTokenRoute = '/api/v1/auth/refresh';
    const isRefreshTokenRoute = 
      (typeof resource === 'string' && resource.includes(refreshTokenRoute)) || 
      (resource instanceof Request && resource.url.includes(refreshTokenRoute))

    // add access token auth header to all fetch requests
    // except on refresh token route, because refresh token
    // is needed in auth header for that case
    if (!isRefreshTokenRoute) {
      newOptions.headers = {
        ...newOptions.headers,
        Authorization: `Bearer ${accessToken}`,
      };
    }
    return Promise.resolve([resource, newOptions]);
  },

  requestError: (error: Error) => {
    return Promise.reject(error);
  },

  response: (response: Response) => {
    // check if response is a 401, if so
    // reject and invoke response error handler
    if (response.status === 401) {
      return Promise.reject(response);
    }
    return Promise.resolve(response);
  },

  responseError: async (response: IMonkeyFetchResponse) => {
    // add custom response error handling

    const { request } = response;
    // if response returned 401 unauthorized
    // fetch a new access token
    if (response.status === 401) {

      // your custom methods for handling auth state
      const { accessToken, refreshToken, setAccessToken, setRefreshToken } = localAuthStore();

      // your custom route to refresh access tokens
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      });

      // parse the response from your auth endpoint
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await res.json();
      setAccessToken(newAccessToken);
      setRefreshToken(newRefreshToken);

      // retry the original request
      const originalRequest = request.clone();
      return fetch(originalRequest);
    }

    return Promise.reject(response);
  },
});
```
