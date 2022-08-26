# `@timwheeler/monkey-fetch`
A monkey-patch library for the native JavaScript `fetch` API, inspired by [`fetch-intercept`](https://www.npmjs.com/package/fetch-intercept).

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
    return response;
  },
  responseError: (response: IMonkeyFetchResponse) => {
    // add custom response error handler logic
    return Promise.reject(response);
  },
});
```

### Example
```typescript
import { MonkeyFetch } from '@timwheeler/monkey-fetch';

const monkeyFetch = new MonkeyFetch();

monkeyFetch.configure({
  request: (resource: RequestInfo | URL, options: RequestInit): Promise<[(RequestInfo | URL), RequestInit]> => {
    
    const newOptions: RequestInit = { ...options };

    // add json content-type to all reqs with a payload
    if (options.body) {
      newOptions.headers = {
        ...newOptions.headers,
        'Content-Type': 'application/json',
      }
    }

    // fetch accessToken from local store
    const { accessToken } = localAuthStore();

    const isRefreshTokenRoute = resource.includes('/api/v1/auth/refresh');
    // add access token auth header to all fetch requests
    // except on refresh token route
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
    return response;
  },
  
  responseError: async (response: IMonkeyFetchResponse) => {
    // add custom response error handling

    const { request } = response;
    // if response returned 401 unauthorized
    // fetch a new access token
    if (response.status === 401) {

      // your custom methods for handling auth state
      const { accessToken, refreshToken, setAccessToken } = localAuthStore();

      // your custom route to refresh access tokens
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      });

      // parse the response from your auth endpoint
      const { accessToken: newAccessToken } = await res.json();
      setAccessToken(newAccessToken);

      // retry the original request
      const originalRequest = request.clone();
      return await fetch(originalRequest, {
        headers: {
          Authorization: `Bearer ${newAccessToken}`,
        }
      });
    }

    return Promise.reject(response);
  },
});
```
