#!/bin/sh
set -e

# KANBANWOOT_AUTH:
#   proxy   (padrão) o nginx repassa as chamadas ao Chatwoot com um token de serviço
#   session o KanbanWoot fica no mesmo domínio do Chatwoot e usa a sessão do agente logado
AUTH_MODE="${KANBANWOOT_AUTH:-proxy}"

# Aceita os nomes novos (CHATWOOT_*) e, por compatibilidade, os antigos (REACT_APP_CHATWOOT_*)
CHATWOOT_URL="${CHATWOOT_URL:-$REACT_APP_CHATWOOT_URL}"
CHATWOOT_TOKEN="${CHATWOOT_TOKEN:-$REACT_APP_CHATWOOT_TOKEN}"
CHATWOOT_ACCOUNT_ID="${CHATWOOT_ACCOUNT_ID:-$REACT_APP_CHATWOOT_ACCOUNT_ID}"
DEBUG="${REACT_APP_DEBUG:-false}"
# Dias na mesma etapa até o card ser marcado como parado
STALE_DAYS="${KANBANWOOT_STALE_DAYS:-7}"
# Subcaminho em que o app é publicado sem remover o prefixo (ex.: /kanban); vazio = raiz
BASE_PATH="${KANBANWOOT_BASE_PATH%/}"

# Remove barra final da URL
CHATWOOT_URL="${CHATWOOT_URL%/}"
# URL do Chatwoot vista pelo navegador (links "abrir no Chatwoot"); padrão: CHATWOOT_URL
CHATWOOT_PUBLIC_URL="${CHATWOOT_PUBLIC_URL:-$CHATWOOT_URL}"
CHATWOOT_PUBLIC_URL="${CHATWOOT_PUBLIC_URL%/}"

case "$AUTH_MODE" in
  proxy) required="CHATWOOT_URL CHATWOOT_TOKEN CHATWOOT_ACCOUNT_ID" ;;
  session) required="CHATWOOT_ACCOUNT_ID" ;;
  *) echo "Erro: KANBANWOOT_AUTH deve ser 'proxy' ou 'session'" >&2; exit 1 ;;
esac
missing=""
for var in $required; do
  eval "value=\$$var"
  [ -z "$value" ] && missing="$missing $var"
done
if [ -n "$missing" ]; then
  echo "Erro: variáveis obrigatórias não definidas:$missing" >&2
  exit 1
fi
case "$CHATWOOT_ACCOUNT_ID" in
  *[!0-9]*) echo "Erro: CHATWOOT_ACCOUNT_ID deve ser numérico" >&2; exit 1 ;;
esac
case "$STALE_DAYS" in
  ''|*[!0-9]*) echo "Erro: KANBANWOOT_STALE_DAYS deve ser um número de dias" >&2; exit 1 ;;
esac
if [ -n "$BASE_PATH" ] && ! echo "$BASE_PATH" | grep -Eq '^(/[A-Za-z0-9_-]+)+$'; then
  echo "Erro: KANBANWOOT_BASE_PATH deve ser como /kanban" >&2
  exit 1
fi

export CHATWOOT_URL CHATWOOT_TOKEN CHATWOOT_ACCOUNT_ID
VARS='${CHATWOOT_URL} ${CHATWOOT_TOKEN} ${CHATWOOT_ACCOUNT_ID}'
envsubst "$VARS" < /etc/nginx/templates-kbw/nginx.conf.template > /etc/nginx/conf.d/default.conf

if [ "$AUTH_MODE" = "proxy" ]; then
  envsubst "$VARS" < /etc/nginx/templates-kbw/chatwoot-proxy.conf.template > /etc/nginx/chatwoot-proxy.conf
  chmod 600 /etc/nginx/chatwoot-proxy.conf
  PROXY_LINE='  REACT_APP_CHATWOOT_PROXY: "/chatwoot-api",'
else
  # Modo sessão: sem token no container; o navegador fala direto com o Chatwoot (mesmo domínio)
  echo "return 404;" > /etc/nginx/chatwoot-proxy.conf
  PROXY_LINE='  REACT_APP_AUTH_MODE: "session",'
fi

# Subcaminho sem remoção de prefixo: /kanban/... é servido como /...
if [ -n "$BASE_PATH" ]; then
  cat <<NGINX > /etc/nginx/kbw-base-path.conf
location = $BASE_PATH { absolute_redirect off; return 301 $BASE_PATH/\$is_args\$args; }
rewrite ^$BASE_PATH(/.*)\$ \$1 last;
NGINX
else
  : > /etc/nginx/kbw-base-path.conf
fi

# O front não recebe o token
ENV_FILE="/usr/share/nginx/html/.env.js"
cat <<JS > "$ENV_FILE"
window._env_ = {
$PROXY_LINE
  REACT_APP_CHATWOOT_ACCOUNT_ID: "${CHATWOOT_ACCOUNT_ID}",
  REACT_APP_CHATWOOT_PUBLIC_URL: "${CHATWOOT_PUBLIC_URL}",
  REACT_APP_STALE_DAYS: "${STALE_DAYS}",
  REACT_APP_DEBUG: "${DEBUG}"
};
JS

if [ "$AUTH_MODE" = "proxy" ]; then
  echo "Modo proxy: chamadas repassadas para $CHATWOOT_URL (conta $CHATWOOT_ACCOUNT_ID); $ENV_FILE gerado sem token."
else
  echo "Modo sessão: usa a sessão do agente logado no Chatwoot (conta $CHATWOOT_ACCOUNT_ID)${BASE_PATH:+, publicado em $BASE_PATH/}."
fi

exec nginx -g "daemon off;"
