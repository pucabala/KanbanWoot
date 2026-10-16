const isDebug = (process.env.REACT_APP_DEBUG || (window._env_ && window._env_.REACT_APP_DEBUG)) === 'true';

export function debugLog(...args) {
  if (!isDebug) return;
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.log('[DEBUG]', ...args);
  const logDiv = document.getElementById('debug-log');
  if (logDiv) {
    const p = document.createElement('div');
    p.textContent = msg;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}