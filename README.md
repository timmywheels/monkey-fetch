# `monkeyfetch`
A monkey-patch library for the native JavaScript `fetch` API, inspired by [`fetch-intercept`](https://www.npmjs.com/package/fetch-intercept).

```typescript
const fetchConfig = new MonkeyFetch();

fetchConfig.configure({
  request: (resource, options) => {
    // add custom request handler
    // example: add Authorization headers to all requests
    const newOptions = { ...options };
    const { accessToken } = customAuthHook();
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
    if (response.status === 401) {
      throw new Error('Access token expired');
    }
    return response;
  },
  responseError: (error: Error) => {
    // add custom response error handling
    return Promise.reject(error);
  },
});
```
