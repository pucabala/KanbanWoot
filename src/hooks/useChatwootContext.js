import { useEffect, useState } from 'react';
import { AUTH_MODE, CHATWOOT_PUBLIC_ORIGIN } from '../api';

// Mensagens do Painel de Aplicativos do Chatwoot (dashboard apps)
const FETCH_INFO_MESSAGE = 'chatwoot-dashboard-app:fetch-info';
const APP_CONTEXT_EVENT = 'appContext';
// O Chatwoot só reenvia o contexto quando o painel volta a ficar visível, não ao trocar de conversa;
// por isso o pedido é repetido periodicamente
const POLL_MS = 2000;

// Origem esperada das mensagens: a do próprio app no modo sessão, a do Chatwoot no modo proxy (se conhecida)
function isTrustedOrigin(origin) {
  if (AUTH_MODE === 'session') return origin === window.location.origin;
  return !CHATWOOT_PUBLIC_ORIGIN || origin === CHATWOOT_PUBLIC_ORIGIN;
}

/**
 * Quando o KanbanWoot está no Painel de Aplicativos do Chatwoot, retorna o contato da conversa aberta.
 * O contexto não é assinado: serve só para destacar o card, nunca para autenticar.
 */
export function useChatwootContext() {
  const [contact, setContact] = useState(null);

  useEffect(() => {
    if (window.parent === window) return undefined;

    const onMessage = event => {
      if (event.source !== window.parent || !isTrustedOrigin(event.origin)) return;
      let message = event.data;
      if (typeof message === 'string') {
        try { message = JSON.parse(message); } catch { return; }
      }
      if (message?.event !== APP_CONTEXT_EVENT) return;
      const next = message.data?.contact || null;
      setContact(prev => {
        if (!next) return null;
        // Evita re-render se nada relevante mudou
        if (prev && prev.id === next.id && JSON.stringify(prev.custom_attributes) === JSON.stringify(next.custom_attributes)) {
          return prev;
        }
        return { id: next.id, name: next.name, custom_attributes: next.custom_attributes || {} };
      });
    };

    const requestContext = () => window.parent.postMessage(FETCH_INFO_MESSAGE, '*');
    window.addEventListener('message', onMessage);
    requestContext();
    const timer = setInterval(requestContext, POLL_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(timer);
    };
  }, []);

  return { contact };
}
