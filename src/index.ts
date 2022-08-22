interface IMonkeyFetchRequestConfiguration {
  request?: (resource: RequestInfo | URL, options: RequestInit) => Promise<any[]> | any[];
  requestError?: (error: Error) => Promise<any>;
}

interface IMonkeyFetchResponseConfiguration {
  response?: (response: Response) => Response;
  responseError?: (error: Error) => Promise<any>;
}

interface IMonkeyFetchConfiguration extends IMonkeyFetchRequestConfiguration, IMonkeyFetchResponseConfiguration {
}

interface IMonkeyPatchResponse extends Response {
  request: Request;
}

export class MonkeyFetch {
  map: IMonkeyFetchConfiguration = {
    request: (resource: RequestInfo | URL, options: RequestInit) => Promise.resolve([resource, options]),
    requestError: (error: Error) => Promise.reject(error),
    response: (response: Response) => response,
    responseError: (error: Error) => Promise.reject(error),
  };

  constructor() {
    this.init();
  }

  protected init() {
    // check if current javascript context is browser or node runtime
    const isBrowserExecutionContext = typeof window !== 'undefined';
    if (isBrowserExecutionContext) {
      require('whatwg-fetch');
    } else {
      require('./fetch-polyfill');
    }
  }

  protected applyInterceptors(fetch, ...args) {
    const {
      request,
      requestError,
      response,
      responseError,
    } = this.map;

    // init promise with original args proceed to monkey-patch
    let monkeyPatchedPromise: Promise<any> = Promise.resolve(args);

    // register request interceptors
    monkeyPatchedPromise = monkeyPatchedPromise.then(
      (args: [RequestInfo | URL, RequestInit]) => request(...args),
      requestError,
    );

    monkeyPatchedPromise = monkeyPatchedPromise.then((args: [RequestInfo | URL, RequestInit]) => {
      const request = new Request(...args);
      return fetch(request).then((response: IMonkeyPatchResponse) => {
        response.request = request;
        return response;
      }).catch((error) => {
        error.request = request;
        return Promise.reject(error);
      });
    });

    // register response interceptors
    monkeyPatchedPromise = monkeyPatchedPromise.then(response, responseError);

    return monkeyPatchedPromise;
  }

  // public api to configure fetch
  configure(configuration: IMonkeyFetchConfiguration) {
    for (let interceptorKey in configuration) {
      this.map[interceptorKey] = configuration[interceptorKey];
    }

    // apply custom config to global fetch method
    // passing all args from fetch requests to monkey-patched fetch
    globalThis.fetch = ((fetch) => (...args) =>
      this.applyInterceptors(fetch, ...args))(globalThis.fetch);
  }
}


