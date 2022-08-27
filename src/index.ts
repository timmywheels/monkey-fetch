interface IMonkeyFetchRequestConfiguration {
  request?: (resource: RequestInfo | URL, options: RequestInit) => Promise<[(RequestInfo | URL), RequestInit]>;
  requestError?: (error: Error) => Promise<any>;
}

interface IMonkeyFetchResponseConfiguration {
  response?: (response: IMonkeyFetchResponse) => Promise<IMonkeyFetchResponse>;
  responseError?: (response: IMonkeyFetchResponse) => Promise<any>;
}

interface IMonkeyFetchMetaConfiguration {
  debug?: boolean;
}

interface IMonkeyFetchConfiguration
  extends IMonkeyFetchRequestConfiguration, IMonkeyFetchResponseConfiguration, IMonkeyFetchMetaConfiguration {
}

interface IMonkeyFetchResponse extends Response {
  request: Request;
}

export class MonkeyFetch {
  debug: boolean = false;
  private readonly interceptors: IMonkeyFetchConfiguration = {
    request: (resource: (RequestInfo | URL), options: RequestInit): Promise<[(RequestInfo | URL), RequestInit]> => Promise.resolve([resource, options]),
    requestError: (error: Error) => Promise.reject<IMonkeyFetchResponse>(error),
    response: (response: IMonkeyFetchResponse) => Promise.resolve(response),
    responseError: (response: IMonkeyFetchResponse) => Promise.reject(response),
  };

  constructor() {
    this.getCurrentRuntimeContext();
  }

  /**
   * @description Determine the current JS runtime context, either Browser or Node.js
   */
  private getCurrentRuntimeContext(): void {
    const isBrowserExecutionContext = typeof window !== 'undefined';
    this.debugLog(isBrowserExecutionContext ? 'Browser runtime' : 'Node Runtime');
    if (isBrowserExecutionContext) {
      require('whatwg-fetch');
    } else {
      require('./fetch-polyfill');
    }
  }

  /**
   * @description Applies the default or user-supplied `request` and/or the `requestError` interceptors
   * @param {[(RequestInfo | URL), RequestInit]} args - the request arguments used to create the monkey-patched request
   * @returns {Promise<IMonkeyFetchResponse>} - the Promise containing the request arguments after interceptors have been applied
   */
  private async applyRequestInterceptors(args: [(RequestInfo | URL), RequestInit]): Promise<[(RequestInfo | URL), RequestInit]> {
    this.debugLog('Initial Request Args:', args);
    const { request, requestError } = this.interceptors;
    try {
      return request(...args);
    } catch (err) {
      return requestError(err);
    }
  }

  /**
   * @description Returns the monkey-patched promise that was either resolved or rejected
   * @param {Function} fetch - the Fetch API for the current JavaScript runtime context
   * @param {[(RequestInfo | URL), RequestInit]} args - the request arguments used to create the monkey-patched request
   * @returns {Promise<IMonkeyFetchResponse>} - the Promise containing the response with interceptors applied
   */
  private async sendInterceptedRequest(fetch: Function, args: [(RequestInfo | URL), RequestInit]): Promise<IMonkeyFetchResponse> {
    const interceptedRequest = new Request(...args);
    try {
      const resolvedResponse: IMonkeyFetchResponse = await fetch(interceptedRequest);
      resolvedResponse.request = interceptedRequest;
      this.debugLog('Intercepted Request:', interceptedRequest);
      this.debugLog('Resolved Response:', resolvedResponse);
      return resolvedResponse;
    } catch (error) {
      error.request = interceptedRequest;
      return error;
    }
  }

  /**
   * @description Applies the default or user-supplied `response` and `responseError` interceptors
   * @param {IMonkeyFetchResponse} initialResponse - the initial, unaltered response before interceptors are applied
   * @returns {Promise<IMonkeyFetchResponse>} - the response with interceptors applied
  */
  private async applyResponseInterceptors(initialResponse: IMonkeyFetchResponse): Promise<IMonkeyFetchResponse> {
    const { response, responseError } = this.interceptors;
    try {
      const monkeyFetchResponse = response(initialResponse);
      this.debugLog('Intercepted Response:', monkeyFetchResponse);
      return monkeyFetchResponse;
    } catch (err) {
      return responseError(err);
    }
  }

  /**
   * @description Applies all interceptors to the request and response objects
   * @param {Function} fetch - the Fetch API for the current JavaScript runtime context
   * @param {[(RequestInfo | URL), RequestInit]} args - the request arguments used to create the monkey-patched request
   * @returns {Promise<IMonkeyFetchResponse>} - the response with all interceptors applied
   */
  protected async applyInterceptors(fetch: Function, ...args: [(RequestInfo | URL), RequestInit]): Promise<any> {
    const monkeyFetchRequestOptions = await this.applyRequestInterceptors(args);
    const responseWithoutInterceptors = await this.sendInterceptedRequest(fetch, monkeyFetchRequestOptions);
    return await this.applyResponseInterceptors(responseWithoutInterceptors);
  }

  /**
   * Debugging tool for internal logging
   * @param {any} args - Arbitrary arguments to be emitted via logger
   * @returns {void}
   */
  private debugLog(...args: any): void {
    if (this.debug) {
      console.warn(`[DEBUG] @timwheeler/monkey-fetch | `, ...args);
    }
  }

  /**
   * @description Custom, user-supplied configuration that is applied to `MonkeyFetch`
   * @param {IMonkeyFetchConfiguration} configuration - Custom configuration applied to all requests and responses
   * @returns {void}
   */
  configure(configuration: IMonkeyFetchConfiguration): void {
    for (let configurationKey in configuration) {
      if (configurationKey in this.interceptors) {
        this.interceptors[configurationKey] = configuration[configurationKey];
      } else {
        this[configurationKey] = configuration[configurationKey];
      }
    }

    globalThis.fetch = ((fetch) => (...args) =>
      this.applyInterceptors(fetch, ...args))(globalThis.fetch);
  }
}
