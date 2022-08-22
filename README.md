# `monkeyfetch`
A monkey-patch library for the native JavaScript `fetch` API, inspired by [`fetch-intercept`](https://www.npmjs.com/package/fetch-intercept).

```typescript
fetchConfig.configure({
  request: (resource, options) => {
    // add custom request handler
    
    // example: add Authorization headers to all requests
    const newOptions = { ...options };
    
    // fetch accessToken from local store
    const { accessToken } = localAuthStore();
    
    // add auth token to all fetch requests
    newOptions.headers = {
      ...newOptions.headers,
      Authorization: `Bearer ${accessToken}`,
    };
    return Promise.resolve([resource, newOptions]);
  },
  requestError: (error: Error) => {
    // add custom request error handler
    return Promise.reject(error);
  },
  response: (response: Response) => {
    // add custom response handling
    // example: check if response is a 401, if so
    // reject and invoke response error handler
    if (response.status === 401) {
      return Promise.reject(response);
    }
    return response;
  },
  responseError: async (response: IMonkeyFetchResponse) => {
    const { request } = response;
    // example: if response returned 401
    // fetch a new accessToken
    if (response.status === 401) {

      // your custom methods for handling accessToken
      const { accessToken, refreshToken, setAccessToken } = localAuthStore();
      
      const res = await fetch('http://localhost:5000/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken })
      });

      // parse the response from your auth endpoint
      const { accessToken: newAccessToken } = await res.json();

      
      setAccessToken(accessToken);

      // retry the original request
      const originalRequest = request.clone();
      return await fetch(originalRequest, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        }
      });
    }

    return Promise.reject(response);
  },
});
```
