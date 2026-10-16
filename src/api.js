import { debugLog } from './debug';

// Variáveis do .env (dev local) com fallback para o .env.js (runtime/Docker, onde o .env não entra no build)
const runtimeEnv = window._env_ || {};
const env = {
  REACT_APP_CHATWOOT_URL: process.env.REACT_APP_CHATWOOT_URL || runtimeEnv.REACT_APP_CHATWOOT_URL,
  REACT_APP_CHATWOOT_ACCOUNT_ID: process.env.REACT_APP_CHATWOOT_ACCOUNT_ID || runtimeEnv.REACT_APP_CHATWOOT_ACCOUNT_ID,
  REACT_APP_CHATWOOT_TOKEN: process.env.REACT_APP_CHATWOOT_TOKEN || runtimeEnv.REACT_APP_CHATWOOT_TOKEN
};
const CHATWOOT_URL = (env.REACT_APP_CHATWOOT_URL || '').replace(/\/+$/, '');
const ACCOUNT_ID = env.REACT_APP_CHATWOOT_ACCOUNT_ID;

// Dias na mesma etapa até o card ser marcado como parado (metade disso: atenção)
export const STALE_DAYS = Number(process.env.REACT_APP_STALE_DAYS || runtimeEnv.REACT_APP_STALE_DAYS) || 7;

// Etapas finais: ao mover para uma delas, o KanbanWoot pede o motivo (obrigatório na perda)
const splitList = value => String(value || '').split(',').map(v => v.trim()).filter(Boolean);
const configList = (name, fallback) => {
  const list = splitList(process.env[`REACT_APP_${name}`] || runtimeEnv[`REACT_APP_${name}`]);
  return list.length ? list : fallback;
};
const WON_STAGES = configList('WON_STAGES', ['Ganho', 'Ganhou', 'Vendido', 'Fechado', 'Fechado ganho', 'Won']);
const LOST_STAGES = configList('LOST_STAGES', ['Perdido', 'Perdeu', 'Fechado perdido', 'Cancelado', 'Lost']);
// Motivos sugeridos na perda (o agente também pode escrever outro)
export const LOST_REASONS = configList('LOST_REASONS', []);

const normalize = text => String(text).trim().toLocaleLowerCase('pt-BR');
// 'won', 'lost' ou null
export function stageOutcome(stage) {
  const name = normalize(stage);
  if (LOST_STAGES.some(s => normalize(s) === name)) return 'lost';
  if (WON_STAGES.some(s => normalize(s) === name)) return 'won';
  return null;
}

// Atributo com o motivo do ganho/perda (ex.: kbw_funil_motivo)
export const STAGE_REASON_SUFFIX = '_motivo';
export const stageReasonKey = attributeKey => `${attributeKey}${STAGE_REASON_SUFFIX}`;

// Sufixo do atributo que guarda quando o contato entrou na etapa atual (ex.: kbw_funil_desde)
export const STAGE_SINCE_SUFFIX = '_desde';
export const stageSinceKey = attributeKey => `${attributeKey}${STAGE_SINCE_SUFFIX}`;

// Modos de autenticação:
// - 'session': o KanbanWoot é servido no mesmo domínio do Chatwoot e usa a sessão do agente logado
// - 'proxy':   (Docker) o nginx do KanbanWoot repassa as chamadas e injeta o token de serviço
// - 'token':   (dev local) o token do .env vai direto do navegador para o Chatwoot
const PROXY_PATH = (runtimeEnv.REACT_APP_CHATWOOT_PROXY || '').replace(/\/+$/, '');
export const AUTH_MODE = (process.env.REACT_APP_AUTH_MODE || runtimeEnv.REACT_APP_AUTH_MODE) === 'session'
  ? 'session'
  : (!process.env.REACT_APP_CHATWOOT_URL && PROXY_PATH ? 'proxy' : 'token');

// Cookie em que o painel do Chatwoot guarda a sessão do agente (mesmo domínio)
const CHATWOOT_SESSION_COOKIE = 'cw_d_session_info';
const SESSION_HEADER_KEYS = ['access-token', 'token-type', 'client', 'expiry', 'uid'];

// Endereço da tela de login do Chatwoot (modo sessão: mesmo domínio)
export const CHATWOOT_LOGIN_URL = '/app/login';

// Origem pública do Chatwoot (para conferir mensagens do Painel de Aplicativos no modo proxy)
export const CHATWOOT_PUBLIC_ORIGIN = (() => {
  try {
    const url = process.env.REACT_APP_CHATWOOT_URL || runtimeEnv.REACT_APP_CHATWOOT_PUBLIC_URL;
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
})();

// Link para o contato no painel do Chatwoot (null se a URL pública do Chatwoot não for conhecida)
export function getChatwootContactUrl(contactId) {
  const base = AUTH_MODE === 'session'
    ? ''
    : (process.env.REACT_APP_CHATWOOT_URL || runtimeEnv.REACT_APP_CHATWOOT_PUBLIC_URL || '').replace(/\/+$/, '');
  if (AUTH_MODE !== 'session' && !base) return null;
  return `${base}/app/accounts/${ACCOUNT_ID}/contacts/${contactId}`;
}

function notLoggedInError() {
  const error = new Error('Você não está logado no Chatwoot.');
  error.status = 401;
  error.code = 'NOT_LOGGED_IN';
  return error;
}

// Lê os headers de autenticação da sessão do Chatwoot (relidos a cada chamada: o agente pode ter trocado de conta)
function getSessionHeaders() {
  let session = null;
  try {
    const entry = document.cookie.split('; ').find(c => c.startsWith(`${CHATWOOT_SESSION_COOKIE}=`));
    if (entry) session = JSON.parse(decodeURIComponent(entry.slice(CHATWOOT_SESSION_COOKIE.length + 1)));
  } catch {
    session = null;
  }
  if (!session || !session['access-token'] || !session.client || !session.uid) throw notLoggedInError();
  const headers = {};
  SESSION_HEADER_KEYS.forEach(key => {
    if (session[key]) headers[key] = String(session[key]);
  });
  return headers;
}

function buildRequest(endpoint, { accountScoped = true } = {}) {
  const base = { 'Content-Type': 'application/json' };
  if (AUTH_MODE === 'session') {
    const prefix = accountScoped ? `/api/v1/accounts/${ACCOUNT_ID}` : '/api/v1';
    return { url: `${prefix}${endpoint}`, headers: { ...base, ...getSessionHeaders() } };
  }
  if (AUTH_MODE === 'proxy') {
    return { url: `${PROXY_PATH}${endpoint}`, headers: base };
  }
  const prefix = accountScoped ? `/api/v1/accounts/${ACCOUNT_ID}` : '/api/v1';
  return { url: `${CHATWOOT_URL}${prefix}${endpoint}`, headers: { ...base, api_access_token: env.REACT_APP_CHATWOOT_TOKEN } };
}

async function chatwootFetch(endpoint, options = {}, requestOptions = {}) {
  const { url, headers: chatwootHeaders } = buildRequest(endpoint, requestOptions);
  debugLog('chatwootFetch', url, options);
  try {
    const response = await fetch(url, { ...options, headers: chatwootHeaders });
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    if (!response.ok) {
      if (AUTH_MODE === 'session' && response.status === 401) throw notLoggedInError();
      const errorDetails = {
        message: `Erro na API: ${url} ${response.status}`,
        status: response.status,
        url,
        method: options.method || 'GET',
        requestBody: options.body,
        response: responseData,
        stack: (new Error()).stack
      };
      debugLog('Detalhes do erro Chatwoot:', errorDetails);
      const error = new Error(errorDetails.message);
      Object.assign(error, errorDetails);
      throw error;
    }
    return responseData;
  } catch (error) {
    debugLog('Erro na requisição Chatwoot:', error);
    throw error;
  }
}

debugLog('api.js: módulo carregado');

// Modo sessão: confere quem é o agente logado e se ele tem acesso à conta configurada
export async function getCurrentAgent() {
  const profile = await chatwootFetch('/profile', {}, { accountScoped: false });
  const accounts = Array.isArray(profile?.accounts) ? profile.accounts : [];
  if (!accounts.some(acc => String(acc.id) === String(ACCOUNT_ID))) {
    const error = new Error(`Seu usuário do Chatwoot não tem acesso à conta ${ACCOUNT_ID}.`);
    error.status = 403;
    error.code = 'NO_ACCOUNT_ACCESS';
    throw error;
  }
  return { id: profile.id, name: profile.name, email: profile.email };
}

// Coluna especial para contatos sem valor no atributo selecionado
export const UNASSIGNED_STAGE = 'Não definido';

// Atributo opcional: se existir na conta, só contatos com kanbanwoot = true entram no board
export const KANBANWOOT_FLAG_KEY = 'kanbanwoot';

// Retorna uma página dos contatos de uma coluna (valor do atributo), filtrando no servidor.
// Para UNASSIGNED_STAGE, busca contatos sem valor no atributo.
// onlyFlagged: aplica também o filtro kanbanwoot = true.
// search: texto buscado no nome, telefone (se tiver dígitos) ou e-mail (se tiver @).
// label: etiqueta do contato.
export async function getContactsByStage(attributeKey, stage, page = 1, { onlyFlagged = false, search = '', label = '' } = {}) {
  debugLog('api.js: getContactsByStage chamado', attributeKey, stage, page, { onlyFlagged, search, label });
  const filters = [];
  if (onlyFlagged) {
    filters.push({ attribute_key: KANBANWOOT_FLAG_KEY, filter_operator: 'equal_to', values: [true] });
  }
  const searchFilter = buildSearchFilter(search);
  if (searchFilter) filters.push(searchFilter);
  if (label) {
    filters.push({ attribute_key: 'labels', filter_operator: 'equal_to', values: [label] });
  }
  filters.push(stage === UNASSIGNED_STAGE
    ? { attribute_key: attributeKey, filter_operator: 'is_not_present', values: [] }
    : { attribute_key: attributeKey, filter_operator: 'equal_to', values: [stage] });
  // Chatwoot: cada filtro liga ao próximo por query_operator; o último leva null
  const payload = filters.map((f, i) => ({ ...f, query_operator: i < filters.length - 1 ? 'and' : null }));
  try {
    const data = await chatwootFetch(`/contacts/filter?page=${page}`, {
      method: 'POST',
      body: JSON.stringify({ payload })
    });
    const contacts = data?.payload || [];
    const count = typeof data?.meta?.count === 'number' ? data.meta.count : null;
    return { contacts, count };
  } catch (error) {
    debugLog('Erro ao buscar contatos da coluna:', error);
    throw error;
  }
}

// O filtro do Chatwoot só encadeia condições (sem parênteses), então a busca usa um campo só:
// e-mail se tiver @, telefone se for só dígitos/símbolos de telefone, senão nome
function buildSearchFilter(search) {
  const text = (search || '').trim();
  if (!text) return null;
  if (text.includes('@')) return { attribute_key: 'email', filter_operator: 'contains', values: [text] };
  if (/^[\d\s()+.-]+$/.test(text) && /\d/.test(text)) {
    return { attribute_key: 'phone_number', filter_operator: 'contains', values: [text.replace(/[^\d+]/g, '')] };
  }
  return { attribute_key: 'name', filter_operator: 'contains', values: [text] };
}

// Retorna as etiquetas da conta (para o filtro)
export async function getLabels() {
  debugLog('api.js: getLabels chamado');
  const data = await chatwootFetch('/labels');
  const all = data?.payload || data || [];
  return Array.isArray(all) ? all.map(l => l.title).filter(Boolean) : [];
}

// Retorna todos os atributos customizados (lista) apenas do tipo contact_attribute
export async function getCustomAttributes() {
  debugLog('api.js: getCustomAttributes chamado');
  try {
    // Busca todos os atributos customizados
    const data = await chatwootFetch('/custom_attribute_definitions');
    // Filtra apenas os de contato
    const all = data.payload || data || [];
    const filtered = Array.isArray(all)
      ? all.filter(attr => attr.attribute_model === 'contact_attribute')
      : [];
    return filtered;
  } catch (error) {
    debugLog('Erro ao buscar atributos customizados:', error);
    throw error;
  }
}

// Retorna um atributo customizado específico pelo ID
export async function getCustomAttributeById(id) {
  debugLog('api.js: getCustomAttributeById chamado', id);
  try {
    const data = await chatwootFetch(`/custom_attribute_definitions/${id}`);
    return data.payload || data; // pode vir como objeto direto
  } catch (error) {
    debugLog('Erro ao buscar atributo customizado por ID:', error);
    throw error;
  }
}

// Atualiza vários atributos customizados do contato de uma vez (o Chatwoot mescla com os existentes)
export async function updateContactCustomAttributes(contactId, attributes) {
  debugLog('api.js: updateContactCustomAttributes chamado', contactId, attributes);
  return chatwootFetch(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify({ custom_attributes: attributes })
  });
}

// Remove atributos customizados do contato
export async function removeContactCustomAttributes(contactId, attributeKeys) {
  debugLog('api.js: removeContactCustomAttributes chamado', contactId, attributeKeys);
  return chatwootFetch(`/contacts/${contactId}/destroy_custom_attributes`, {
    method: 'POST',
    body: JSON.stringify({ custom_attributes: attributeKeys })
  });
}
