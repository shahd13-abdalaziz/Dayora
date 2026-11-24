// Talks to the Dayora server (ASP.NET Core). Every page uses this one file.
//
//   Api.get('/tasks')                       -> parsed JSON
//   Api.post('/tasks', { title: 'x' })      -> parsed JSON
//   throws ApiError { status, message, fields } when the server says no.

class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

const Api = {
  // The server also serves these pages, so normally "/api" is enough.
  // When the pages are opened some other way (Live Server on :5501, or a file),
  // talk to the server on its default address.
  base: location.protocol === 'file:' || location.port === '5501'
    ? 'http://localhost:5000/api'
    : '/api',

  loginUrl: location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html',

  async request(method, path, body) {
    const headers = {};
    const token = Store.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetch(this.base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'Cannot reach the server. Is it running? (dotnet run in server/Dayora.Api)');
    }

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // A rejected token means the login is over: go back to the login page.
      if (res.status === 401 && token) {
        Store.clear();
        location.replace(this.loginUrl);
      }
      throw new ApiError(res.status, data.error || 'Something went wrong', data.fields);
    }
    return data;
  },

  get: (path) => Api.request('GET', path),
  post: (path, body) => Api.request('POST', path, body),
  put: (path, body) => Api.request('PUT', path, body),
  patch: (path, body) => Api.request('PATCH', path, body),
  del: (path, body) => Api.request('DELETE', path, body),

  // Downloads a file (like the CSV export). It has to go through fetch so the login header is sent.
  async download(path, fileName) {
    const res = await fetch(this.base + path, { headers: { Authorization: `Bearer ${Store.getToken()}` } });
    if (!res.ok) throw new ApiError(res.status, 'Could not download the file');
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
