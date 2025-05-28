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

// Função para obter parâmetro de conexão (cookie tem prioridade, depois .env, mas se vazio ou nulo, retorna '')
export function getConnectionParam(key, envKey) {
  const cookieVal = getCookie(key);
  if (cookieVal && cookieVal !== '""' && cookieVal !== '') return cookieVal;
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

// Retorna todos os contatos
export async function getContacts() {
  debugLog('api.js: getContacts chamado');
  try {
    const data = await chatwootFetch('/contacts');
    return data.payload || [];
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

// Função utilitária para debug visual dos parâmetros de conexão
export function showConnectionDebug() {
  const url = getCookie('chatwoot_url') || (window._env_ && window._env_.REACT_APP_CHATWOOT_URL);
  const accountId = getCookie('chatwoot_account_id') || (window._env_ && window._env_.REACT_APP_CHATWOOT_ACCOUNT_ID);
  const token = getCookie('chatwoot_token') || (window._env_ && window._env_.REACT_APP_CHATWOOT_TOKEN);
  // Mostra no console e também pode ser usado em UI
  debugLog('[DEBUG] Parâmetros de conexão:', { url, accountId, token });
  return { url, accountId, token };
}