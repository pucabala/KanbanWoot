//api.js
import { debugLog } from './debug';
import React, { useEffect, useState } from 'react';

// Funções utilitárias para cookie
export function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}
export function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

// Validação básica de parâmetros
function isValidAccountId(val) {
  return /^\d+$/.test(val);
}
function isValidToken(val) {
  return typeof val === 'string' && val.length > 10 && !/\s/.test(val);
}
function isValidUrl(val) {
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
}

// Função para obter parâmetro de conexão (prioridade: querystring > cookie > env.js)
export function getConnectionParam(key, envKey) {
  // 1. Querystring
  const params = new URLSearchParams(window.location.search);
  const qsVal = params.get(key);
  if (qsVal && qsVal !== '""' && qsVal !== '') {
    // Validação
    if (key === 'account_id' && !isValidAccountId(qsVal)) return '';
    if (key === 'token' && !isValidToken(qsVal)) return '';
    if (key === 'url' && !isValidUrl(qsVal)) return '';
    // Se veio pela querystring, sobrescreve o cookie
    setCookie(key, qsVal);
    return qsVal;
  }
  // 2. Cookie
  const cookieVal = getCookie(key);
  if (cookieVal && cookieVal !== '""' && cookieVal !== '') {
    if (key === 'account_id' && !isValidAccountId(cookieVal)) return '';
    if (key === 'token' && !isValidToken(cookieVal)) return '';
    if (key === 'url' && !isValidUrl(cookieVal)) return '';
    return cookieVal;
  }
  // 3. .env.js
  const envVal = (window._env_ && window._env_[envKey]) || '';
  if (envVal && envVal !== '""' && envVal !== '') {
    if (key === 'account_id' && !isValidAccountId(envVal)) return '';
    if (key === 'token' && !isValidToken(envVal)) return '';
    if (key === 'url' && !isValidUrl(envVal)) return '';
    return envVal;
  }
  return '';
}

// Configurações da API do Chatwoot vindas do cookie OU do window._env_
const CHATWOOT_URL = getConnectionParam('url', 'REACT_APP_CHATWOOT_URL');
const ACCOUNT_ID = getConnectionParam('account_id', 'REACT_APP_CHATWOOT_ACCOUNT_ID');
const TOKEN = getConnectionParam('token', 'REACT_APP_CHATWOOT_TOKEN');

const chatwootHeaders = {
  'Content-Type': 'application/json',
  'api_access_token': TOKEN
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

// Retorna uma página de contatos (default page=1)
export async function getContacts(page = 1) {
  debugLog('api.js: getContacts chamado', page);
  try {
    const data = await chatwootFetch(`/contacts?page=${page}`);
    const contacts = data.payload || [];
    debugLog(`Página ${page} retornou ${contacts.length} contatos`);
    return contacts;
  } catch (error) {
    debugLog('Erro ao buscar contatos:', error);
    throw error;
  }
}

// Guarda em memória se existe o atributo kanbanwoot
let hasKanbanwootGlobal = null;

// Função para checar e inicializar o flag global (chamada uma vez no início)
export async function checkKanbanwootExists() {
  if (hasKanbanwootGlobal === null) {
    try {
      const attrs = await getCustomAttributes();
      hasKanbanwootGlobal = attrs.some(a => a.attribute_key === 'kanbanwoot');
      debugLog('[Kanban] kanbanwoot existe?', hasKanbanwootGlobal);
    } catch { hasKanbanwootGlobal = false; }
  }
  return hasKanbanwootGlobal;
}

export async function getContactsFiltered(page = 1, pageSize = 15, attributeKey, stage) {
  debugLog('api.js: getContactsFiltered chamado', { page, pageSize, attributeKey, stage });
  try {
    // Garante que o flag global foi inicializado
    await checkKanbanwootExists();
    let filters = [];
    // Se for busca global (sem filtro de coluna), aplica filtro kanbanwoot se existir
    const isBuscaGlobal = typeof stage === 'undefined';
    if (hasKanbanwootGlobal && isBuscaGlobal) {
      filters.push({
        attribute_key: 'kanbanwoot',
        filter_operator: 'equal_to',
        values: [true]
      });
    }
    // Filtro por valor do atributo selecionado (coluna)
    if (attributeKey && !isBuscaGlobal) {
      if (stage === null) {
        // Coluna "Não Atribuído": contatos sem valor definido
        // Busca todos os valores possíveis do atributo para o filtro does_not_contain
        const attrs = await getCustomAttributes();
        const attr = attrs.find(a => a.attribute_key === attributeKey && Array.isArray(a.attribute_values));
        const allValues = attr ? attr.attribute_values : [];
        filters.push({
          attribute_key: attributeKey,
          filter_operator: 'does_not_contain',
          values: allValues
        });
      } else {
        filters.push({
          attribute_key: attributeKey,
          filter_operator: 'equal_to',
          values: [stage]
        });
      }
    }
    // Adiciona query_operator apenas se houver mais de um filtro
    if (filters.length > 1) {
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].query_operator = 'AND';
      }
    }
    let contacts = [];
    let erroFiltragem = false;
    let data = null;
    try {
      data = await chatwootFetch(`/contacts/filter`, {
        method: 'POST',
        body: JSON.stringify({
          page,
          per_page: pageSize,
          payload: filters
        })
      });
      contacts = data.payload || [];
      // Se for coluna "Não Atribuído", filtra manualmente os contatos sem o atributo
      if (attributeKey && !isBuscaGlobal && stage === null) {
        contacts = contacts.filter(c => !c.custom_attributes || !c.custom_attributes[attributeKey]);
      }
      debugLog(`[Kanban] Filtro aplicado: página ${page} retornou ${contacts.length} contatos`);
    } catch (err) {
      if (err.status === 422) {
        erroFiltragem = true;
        debugLog('[Kanban] Filtro não disponível (erro 422). Fallback para buscar todos os contatos.');
      } else {
        debugLog('[Kanban] Erro inesperado ao filtrar contatos:', err);
        throw err;
      }
    }
    if (contacts.length === 0 || erroFiltragem) {
      debugLog('[Kanban] Executando fallback: buscando todos os contatos (sem filtro).');
      const allData = await chatwootFetch(`/contacts?page=${page}&per_page=${pageSize}`);
      contacts = allData.payload || [];
      debugLog(`[Kanban] Fallback: página ${page} retornou ${contacts.length} contatos (total: ${allData.meta?.count ?? 'desconhecido'})`);
      return { payload: contacts, meta: allData.meta || { count: contacts.length, current_page: page } };
    }
    return { payload: contacts, meta: data.meta || { count: contacts.length, current_page: page } };
  } catch (error) {
    debugLog('[Kanban] Erro fatal ao buscar contatos filtrados:', error);
    throw error;
  }
}

// Guarda em memória os atributos customizados para evitar múltiplas requisições
if (!window._kanbanwoot_customAttributesCache) {
  window._kanbanwoot_customAttributesCache = {
    data: null
  };
}

export async function getCustomAttributes(forceRefresh = false) {
  debugLog('api.js: getCustomAttributes chamado', { forceRefresh });
  const cache = window._kanbanwoot_customAttributesCache;
  if (!forceRefresh && cache.data) {
    return cache.data;
  }
  try {
    // Busca todos os atributos customizados
    const data = await chatwootFetch('/custom_attribute_definitions');
    // Filtra apenas os de contato
    const all = data.payload || data || [];
    const filtered = Array.isArray(all)
      ? all.filter(attr => attr.attribute_model === 'contact_attribute')
      : [];
    cache.data = filtered;
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

// Atualiza o estágio do Kanban de um contato (wrapper para updateContactCustomAttribute)
export async function updateKanbanStage(contactId, stage, attributeKey) {
  debugLog('api.js: updateKanbanStage chamado', contactId, stage, attributeKey);
  // Usa 'kanban' como padrão se não informado
  const key = attributeKey || 'kanban';
  return updateContactCustomAttribute(contactId, key, stage);
}

// Retorna os estágios do Kanban (valores do atributo customizado do tipo 'list')
// Se passado um parâmetro, usa o atributo correspondente; senão, usa o primeiro do tipo 'list'
export async function getKanbanStages(attributeKey) {
  debugLog('api.js: getKanbanStages chamado', attributeKey);
  try {
    const attrs = await getCustomAttributes();
    let attr;
    // 1. Se kbw=nome do funil na querystring, usa ele
    const params = new URLSearchParams(window.location.search);
    const kbwParam = params.get('kbw');
    if (kbwParam) {
      attr = attrs.find(a => a.attribute_display_type === 'list' && a.attribute_key === kbwParam);
      // Salva o kbw no cookie para persistência
      setCookie('kbw', kbwParam);
    }
    // 2. Se não, usa o attributeKey passado (ex: armazenado em cookie)
    if (!attr && attributeKey) {
      attr = attrs.find(a => a.attribute_display_type === 'list' && a.attribute_key === attributeKey);
    }
    // 2b. Se não, tenta pegar do cookie 'kbw'
    if (!attr) {
      const kbwCookie = getCookie('kbw');
      if (kbwCookie) {
        attr = attrs.find(a => a.attribute_display_type === 'list' && a.attribute_key === kbwCookie);
      }
    }
    // 3. Se não, usa o primeiro atributo do tipo lista
    if (!attr) {
      attr = attrs.find(a => a.attribute_display_type === 'list' && Array.isArray(a.attribute_values));
    }
    let stages = [];
    if (attr && Array.isArray(attr.attribute_values)) {
      stages = attr.attribute_values;
    }
    // Sempre adiciona a coluna 'Não Atribuído' ao final
    if (!stages.includes('Não Atribuído')) {
      stages = [...stages, 'Não Atribuído'];
    }
    return stages.length ? stages : ['Não Atribuído'];
  } catch (error) {
    debugLog('Erro ao buscar estágios do Kanban:', error);
    throw error;
  }
}

// Retorna todos os atributos customizados do tipo lista (para dropdown de seleção de funil)
export async function getListAttributes() {
  debugLog('api.js: getListAttributes chamado');
  try {
    const attrs = await getCustomAttributes();
    return attrs.filter(a => a.attribute_display_type === 'list' && Array.isArray(a.attribute_values));
  } catch (error) {
    debugLog('Erro ao buscar atributos do tipo lista:', error);
    throw error;
  }
}

// Função utilitária para debug visual dos parâmetros de conexão
export function showConnectionDebug() {
  const url = getCookie('url') || (window._env_ && window._env_.REACT_APP_CHATWOOT_URL);
  const accountId = getCookie('account_id') || (window._env_ && window._env_.REACT_APP_CHATWOOT_ACCOUNT_ID);
  const token = getCookie('token') || (window._env_ && window._env_.REACT_APP_CHATWOOT_TOKEN);
  // Mostra no console e também pode ser usado em UI
  debugLog('[DEBUG] Parâmetros de conexão:', { url, accountId, token });
  return { url, accountId, token };
}