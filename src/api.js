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

// Função para obter parâmetro de conexão (prioridade: querystring > cookie > env.js)
export function getConnectionParam(key, envKey) {
  // 1. Querystring
  const params = new URLSearchParams(window.location.search);
  const qsVal = params.get(key);
  if (qsVal && qsVal !== '""' && qsVal !== '') {
    // Se veio pela querystring, sobrescreve o cookie
    setCookie(key, qsVal);
    return qsVal;
  }
  // 2. Cookie
  const cookieVal = getCookie(key);
  if (cookieVal && cookieVal !== '""' && cookieVal !== '') return cookieVal;
  // 3. .env.js
  const envVal = (window._env_ && window._env_[envKey]) || '';
  if (envVal && envVal !== '""' && envVal !== '') return envVal;
  return '';
}

// Configurações da API do Chatwoot vindas do cookie OU do window._env_
const CHATWOOT_URL = getConnectionParam('chatwoot_url', 'REACT_APP_CHATWOOT_URL');
const ACCOUNT_ID = getConnectionParam('chatwoot_account_id', 'REACT_APP_CHATWOOT_ACCOUNT_ID');
const TOKEN = getConnectionParam('chatwoot_token', 'REACT_APP_CHATWOOT_TOKEN');

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

// Retorna todos os contatos (busca todas as páginas)
export async function getContacts() {
  debugLog('api.js: getContacts chamado');
  let allContacts = [];
  let page = 1;
  let hasMore = true;
  const perPage = 50; // valor alto para garantir todos os contatos em menos requisições
  try {
    while (hasMore) {
      const data = await chatwootFetch(`/contacts?page=${page}&per_page=${perPage}`);
      const contacts = data.payload || [];
      debugLog(`Página ${page} retornou ${contacts.length} contatos`);
      allContacts = allContacts.concat(contacts);
      hasMore = Array.isArray(contacts) && contacts.length === perPage;
      page++;
    }
    return allContacts;
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
    if (attributeKey) {
      attr = attrs.find(a => a.attribute_key === attributeKey && a.attribute_display_type === 'list');
    }
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
  const url = getCookie('chatwoot_url') || (window._env_ && window._env_.REACT_APP_CHATWOOT_URL);
  const accountId = getCookie('chatwoot_account_id') || (window._env_ && window._env_.REACT_APP_CHATWOOT_ACCOUNT_ID);
  const token = getCookie('chatwoot_token') || (window._env_ && window._env_.REACT_APP_CHATWOOT_TOKEN);
  // Mostra no console e também pode ser usado em UI
  debugLog('[DEBUG] Parâmetros de conexão:', { url, accountId, token });
  return { url, accountId, token };
}