export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
export class Api {
  constructor(server, identity) { this.server = server; this.identity = identity; }
  async request(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetch(`${this.server}/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...(this.identity ? { Authorization: `Bearer ${this.identity.token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(12000), cache: 'no-store', credentials: 'omit', redirect: 'error' });
    } catch { throw new ApiError('Cannot reach your server. Check the server address and connection.', 0); }
    let data;
    try { data = await response.json(); } catch { throw new ApiError('The server returned an unexpected response.', response.status); }
    if (!response.ok) throw new ApiError(data.error || 'Request failed.', response.status);
    return data;
  }
}
