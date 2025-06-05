export function debugLog(...args) {
  // Sempre imprime no console
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.log('[DEBUG]', ...args);
  // Opcional: também mostra em div de debug se existir
  const logDiv = document.getElementById('debug-log');
  if (logDiv) {
    const p = document.createElement('div');
    p.textContent = msg;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}