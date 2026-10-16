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
// No Docker, as chamadas passam pelo proxy do nginx, que injeta o token no servidor
const PROXY_PATH = (runtimeEnv.REACT_APP_CHATWOOT_PROXY || '').replace(/\/+$/, '');
const USE_PROXY = !process.env.REACT_APP_CHATWOOT_URL && Boolean(PROXY_PATH);
const chatwootHeaders = USE_PROXY
  ? { 'Content-Type': 'application/json' }
  : { 'Content-Type': 'application/json', api_access_token: env.REACT_APP_CHATWOOT_TOKEN };

async function chatwootFetch(endpoint, options = {}) {
  const url = USE_PROXY
    ? `${PROXY_PATH}${endpoint}`
    : `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}${endpoint}`;
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
      const errorDetails = {
        message: `Erro na API: ${url} ${response.status}`,
        status: response.status,
        url,
        method: options.method || 'GET',
        requestBody: options.body,
        headers: chatwootHeaders,
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

// Coluna especial para contatos sem valor no atributo selecionado
export const UNASSIGNED_STAGE = 'Não definido';

// Retorna uma página dos contatos de uma coluna (valor do atributo), filtrando no servidor.
// Para UNASSIGNED_STAGE, busca contatos sem valor no atributo.
export async function getContactsByStage(attributeKey, stage, page = 1) {
  debugLog('api.js: getContactsByStage chamado', attributeKey, stage, page);
  const filter = stage === UNASSIGNED_STAGE
    ? { attribute_key: attributeKey, filter_operator: 'is_not_present', values: [], query_operator: null }
    : { attribute_key: attributeKey, filter_operator: 'equal_to', values: [stage], query_operator: null };
  try {
    const data = await chatwootFetch(`/contacts/filter?page=${page}`, {
      method: 'POST',
      body: JSON.stringify({ payload: [filter] })
    });
    const contacts = data?.payload || [];
    const count = typeof data?.meta?.count === 'number' ? data.meta.count : null;
    return { contacts, count };
  } catch (error) {
    debugLog('Erro ao buscar contatos da coluna:', error);
    throw error;
  }
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

// Atualiza o valor de um atributo customizado do contato
export async function updateContactCustomAttribute(contactId, attributeKey, value) {
  debugLog('api.js: updateContactCustomAttribute chamado', contactId, attributeKey, value);
  try {
    return await chatwootFetch(`/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify({ custom_attributes: { [attributeKey]: value } })
    });
  } catch (error) {
    debugLog('Erro ao atualizar atributo customizado:', error);
    throw error;
  }
}

// Remove atributos customizados do contato
export async function removeContactCustomAttributes(contactId, attributeKeys) {
  debugLog('api.js: removeContactCustomAttributes chamado', contactId, attributeKeys);
  return chatwootFetch(`/contacts/${contactId}/destroy_custom_attributes`, {
    method: 'POST',
    body: JSON.stringify({ custom_attributes: attributeKeys })
  });
}
