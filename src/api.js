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
const chatwootHeaders = {
  'Content-Type': 'application/json',
  api_access_token: env.REACT_APP_CHATWOOT_TOKEN
};

async function chatwootFetch(endpoint, options = {}) {
  const url = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}${endpoint}`;
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

// Retorna todos os contatos
export async function getContacts() {
  debugLog('api.js: getContacts chamado');
  try {
    // A API do Chatwoot pagina /contacts; busca a 1ª página e depois as demais em paralelo
    const MAX_PAGES = 1000; // trava de segurança
    const CONCURRENCY = 5; // requisições simultâneas, para não sobrecarregar a API
    const first = await chatwootFetch('/contacts?page=1');
    const all = [...(first?.payload || [])];
    const total = first?.meta?.count;
    const pageSize = all.length;
    if (!pageSize) return all;

    if (typeof total !== 'number') {
      // Sem meta.count: segue sequencialmente até uma página vazia
      for (let page = 2; page <= MAX_PAGES; page++) {
        const data = await chatwootFetch(`/contacts?page=${page}`);
        const items = data?.payload || [];
        if (!items.length) break;
        all.push(...items);
      }
      return all;
    }

    const totalPages = Math.min(Math.ceil(total / pageSize), MAX_PAGES);
    const pages = [];
    for (let page = 2; page <= totalPages; page++) pages.push(page);
    const results = new Array(pages.length);
    let next = 0;
    async function worker() {
      while (next < pages.length) {
        const i = next++;
        const data = await chatwootFetch(`/contacts?page=${pages[i]}`);
        results[i] = data?.payload || [];
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pages.length) }, worker));
    results.forEach(items => all.push(...items));

    // Remove duplicados caso a lista mude durante a paginação
    const seen = new Set();
    return all.filter(c => (seen.has(c.id) ? false : seen.add(c.id)));
  } catch (error) {
    debugLog('Erro ao buscar contatos:', error);
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
