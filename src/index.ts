interface IMonkeyFetchRequestConfiguration {
  request?: (resource: RequestInfo | URL, options: RequestInit) => Promise<any[]> | any[];
  requestError?: (error: Error) => Promise<any>;
}

interface IMonkeyFetchResponseConfiguration {
  response?: (response: Response) => Response | Promise<IMonkeyFetchResponse>;
  responseError?: (response: IMonkeyFetchResponse) => Promise<any>;
}

interface IMonkeyFetchConfiguration
  extends IMonkeyFetchRequestConfiguration, IMonkeyFetchResponseConfiguration {
}

interface IMonkeyFetchResponse extends Response {
  request: Request;
}

export class MonkeyFetch {
  interceptors: IMonkeyFetchConfiguration = {
    request: (resource: (RequestInfo | URL), options: RequestInit): Promise<[(RequestInfo | URL), RequestInit]> => Promise.resolve([resource, options]),
    requestError: (error: Error) => Promise.reject(error),
    response: (response: Response) => response,
    responseError: (response: IMonkeyFetchResponse) => Promise.reject(response),
  };

  constructor() {
    this.init();
  }

  protected init(): void {
    // check if current javascript context is browser or node runtime
    const isBrowserExecutionContext = typeof window !== 'undefined';
    if (isBrowserExecutionContext) {
      require('whatwg-fetch');
    } else {
      require('./fetch-polyfill');
    }
  }

  protected applyInterceptors(fetch, ...args): Promise<any> {
    const {
      request,
      requestError,
      response,
      responseError,
    } = this.interceptors;

    // init promise with original args, proceed to monkey-patch
    let monkeyPatchedPromise: Promise<any> = Promise.resolve(args);

    monkeyPatchedPromise = monkeyPatchedPromise.then(
      (args: [(RequestInfo | URL), RequestInit]) => request(...args),
      requestError,
    );

    monkeyPatchedPromise = monkeyPatchedPromise.then((args: [(RequestInfo | URL), RequestInit]) => {
      const request = new Request(...args);
      return fetch(request).then((response: IMonkeyFetchResponse): IMonkeyFetchResponse => {
        response.request = request;
        return response;
      }).catch((error) => {
        error.request = request;
        return Promise.reject(error);
      });
    });

    monkeyPatchedPromise = monkeyPatchedPromise.then(response).catch(responseError);

    return monkeyPatchedPromise;
  }

  // public api to configure fetch
  configure(configuration: IMonkeyFetchConfiguration): void {
    for (let interceptorKey in configuration) {
      this.interceptors[interceptorKey] = configuration[interceptorKey];
    }

    // apply custom config to global fetch method
    // passing all args from fetch requests to monkey-patched fetch
    globalThis.fetch = ((fetch) => (...args) =>
      this.applyInterceptors(fetch, ...args))(globalThis.fetch);
  }
}
