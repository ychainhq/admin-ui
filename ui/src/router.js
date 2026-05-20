export function createRouter() {
  const routes = [];
  let currentUnbind = null;

  function matchRoute(pattern, path) {
    const paramNames = [];
    const regexStr = '^' + pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    }) + '$';
    const m = path.match(new RegExp(regexStr));
    if (!m) return null;
    const params = {};
    paramNames.forEach((name, i) => { params[name] = m[i + 1]; });
    return params;
  }

  function resolve() {
    const path = window.location.hash.slice(1) || '/';
    for (const { pattern, handler } of routes) {
      const params = matchRoute(pattern, path);
      if (params !== null) return { handler, params };
    }
    return null;
  }

  function handle() {
    if (currentUnbind) { currentUnbind(); currentUnbind = null; }
    const appEl = document.getElementById('app');
    if (appEl) appEl.innerHTML = '';
    const match = resolve();
    if (match) {
      const result = match.handler(match.params);
      if (result?.unbind) currentUnbind = result.unbind;
    }
  }

  const router = {
    on(pattern, handler) {
      routes.push({ pattern, handler });
      return router;
    },
    navigate(hash) {
      window.location.hash = hash;
    },
    start() {
      window.addEventListener('hashchange', handle);
      handle();
    },
    stop() {
      window.removeEventListener('hashchange', handle);
    },
  };

  return router;
}

export function matchRoute(pattern, path) {
  const paramNames = [];
  const regexStr = '^' + pattern.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  }) + '$';
  const m = path.match(new RegExp(regexStr));
  if (!m) return null;
  const params = {};
  paramNames.forEach((name, i) => { params[name] = m[i + 1]; });
  return params;
}
