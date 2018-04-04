import Service from '@ember/service';
import { hash } from 'rsvp';
import fetch, { Request, Headers } from 'fetch';
import { serializeQueryParams } from 'ember-fetch/mixins/adapter-fetch';

export default Service.extend({
  host: '/',
  namespace: null,

  async methodForRequest({ method = 'get' }) {
    return method;
  },

  async headersForRequest({ headers }) {
    return Object.assign({}, this.headers, headers);
  },

  async pathForRequest({ url }) {
    return url;
  },

  async queryForRequest({ query }) {
    return query;
  },

  async bodyForRequest({ data }) {
    return data ? JSON.stringify(data) : null;
  },

  async normalize(params, { body }) {
    return body;
  },

  async normalizeError(params, { body }) {
    return body;
  },

  async request(params) {
    let request = await this.requestFor(params);
    let response = await makeRequest(request);
    response.body = response.ok
      ? await this.normalize(params, response)
      : await this.normalizeError(params, response);

    return Object.freeze(response);
  },

  async urlForRequest(params) {
    let { host, namespace } = this;
    let { path, query } = await hash({
      path: this.pathForRequest(params),
      query: this.queryForRequest(params)
    });

    let url = [host, namespace, path].filter(Boolean).join('');

    if (query) {
      query = serializeQueryParams(query);
      let delimiter = url.indexOf('?') > -1 ? '&' : '?';
      url += `${delimiter}${query}`;
    }

    return url;
  },

  async optionsForRequest({ options }) {
    let { mode = 'cors', credentials = 'same-origin' } = options || {
      mode: 'cors',
      credentials: 'same-origin'
    };

    return {
      mode,
      credentials
    };
  },

  async requestFor(params) {
    params = Object.freeze(params);

    let { method, url, headers, options } = await hash({
      method: this.methodForRequest(params),
      url: this.urlForRequest(params),
      headers: this.headersForRequest(params),
      options: this.optionsForRequest(params)
    });

    method = method.toUpperCase();
    headers = new Headers(headers);

    if (method !== 'GET') {
      headers.append('content-type', 'application/json; charset=utf-8');
    }

    Object.assign(options, {
      method,
      headers
    });

    if (method === 'GET' || method === 'HEAD') {
      if (params.data) {
        throw new Error(`${method} request with body`);
      }
    } else {
      options.body = await this.bodyForRequest(params);
    }

    return new Request(url, options);
  }
});

export async function makeRequest(request, readResponseBody) {
  readResponseBody = readResponseBody || (response => response.json());

  let response = await fetch(request);
  let body = await readResponseBody(response);
  let { ok, status, textStatus, headers } = response;

  headers = Array.from(headers).reduce((headers, [key, value]) => {
    headers[key] = value;
    return headers;
  }, {});

  return {
    ok,
    status,
    textStatus,
    headers,
    body
  };
}
