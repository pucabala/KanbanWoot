#!/bin/sh
set -e

# Aceita os nomes novos (CHATWOOT_*) e, por compatibilidade, os antigos (REACT_APP_CHATWOOT_*)
CHATWOOT_URL="${CHATWOOT_URL:-$REACT_APP_CHATWOOT_URL}"
CHATWOOT_TOKEN="${CHATWOOT_TOKEN:-$REACT_APP_CHATWOOT_TOKEN}"
CHATWOOT_ACCOUNT_ID="${CHATWOOT_ACCOUNT_ID:-$REACT_APP_CHATWOOT_ACCOUNT_ID}"
DEBUG="${REACT_APP_DEBUG:-false}"

# Remove barra final da URL
CHATWOOT_URL="${CHATWOOT_URL%/}"

missing=""
[ -z "$CHATWOOT_URL" ] && missing="$missing CHATWOOT_URL"
[ -z "$CHATWOOT_TOKEN" ] && missing="$missing CHATWOOT_TOKEN"
[ -z "$CHATWOOT_ACCOUNT_ID" ] && missing="$missing CHATWOOT_ACCOUNT_ID"
if [ -n "$missing" ]; then
  echo "Erro: variáveis obrigatórias não definidas:$missing" >&2
  exit 1
fi
case "$CHATWOOT_ACCOUNT_ID" in
  *[!0-9]*) echo "Erro: CHATWOOT_ACCOUNT_ID deve ser numérico" >&2; exit 1 ;;
esac

export CHATWOOT_URL CHATWOOT_TOKEN CHATWOOT_ACCOUNT_ID
VARS='${CHATWOOT_URL} ${CHATWOOT_TOKEN} ${CHATWOOT_ACCOUNT_ID}'
envsubst "$VARS" < /etc/nginx/templates-kbw/nginx.conf.template > /etc/nginx/conf.d/default.conf
envsubst "$VARS" < /etc/nginx/templates-kbw/chatwoot-proxy.conf.template > /etc/nginx/chatwoot-proxy.conf
chmod 600 /etc/nginx/chatwoot-proxy.conf

# O front só recebe o caminho do proxy; o token NÃO vai para o navegador
ENV_FILE="/usr/share/nginx/html/.env.js"
cat <<JS > "$ENV_FILE"
window._env_ = {
  REACT_APP_CHATWOOT_PROXY: "/chatwoot-api",
  REACT_APP_DEBUG: "${DEBUG}"
};
JS
echo "Proxy configurado para $CHATWOOT_URL (conta $CHATWOOT_ACCOUNT_ID); $ENV_FILE gerado sem token."

exec nginx -g "daemon off;"
