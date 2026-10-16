import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import {
  getContactsByStage,
  getCustomAttributes,
  updateContactCustomAttribute,
  removeContactCustomAttributes,
  UNASSIGNED_STAGE,
  KANBANWOOT_FLAG_KEY
} from '../api';
import { kanbanReducer } from '../reducers/kanbanReducer';

// Cookie com o último atributo escolhido
const ATTRIBUTE_COOKIE = 'kbw';

function readAttributeCookie() {
  try {
    const entry = document.cookie.split('; ').find(c => c.startsWith(`${ATTRIBUTE_COOKIE}=`));
    return entry ? decodeURIComponent(entry.slice(ATTRIBUTE_COOKIE.length + 1)) : null;
  } catch {
    return null;
  }
}

function saveAttributeCookie(key) {
  try {
    // SameSite=None; Secure permite gravar/ler dentro do iframe do Painel de Aplicativos do Chatwoot (HTTPS)
    const sameSite = window.location.protocol === 'https:' ? 'SameSite=None; Secure' : 'SameSite=Lax';
    document.cookie = `${ATTRIBUTE_COOKIE}=${encodeURIComponent(key)}; max-age=${365 * 24 * 3600}; path=/; ${sameSite}`;
  } catch {
    // Cookies bloqueados: segue sem lembrar a escolha
  }
}

// Escolhe o atributo: parâmetro ?kbw= da URL, depois o cookie, depois o primeiro lista "kbw_", depois qualquer lista
function selectAttribute(attrs, param, remembered) {
  const lists = attrs.filter(a => a.attribute_display_type === 'list' && a.attribute_values?.length);
  return (
    (param && lists.find(a => a.attribute_key === param)) ||
    (remembered && lists.find(a => a.attribute_key === remembered)) ||
    lists.find(a => a.attribute_key.startsWith('kbw_')) ||
    lists[0] ||
    null
  );
}

export function useKanbanData() {
  const location = useLocation();
  const param = new URLSearchParams(location.search).get('kbw');

  // Definições de atributos de contato (dropdown e nomes amigáveis)
  // null até a primeira resposta da API
  const [attributeDefs, setAttributeDefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Colunas e seus contatos, carregados página a página
  const [board, dispatch] = useReducer(kanbanReducer, {});
  const boardRef = useRef(board);
  boardRef.current = board;

  // Incrementa a cada troca de atributo para descartar respostas de buscas antigas
  const generationRef = useRef(0);
  // Colunas com busca em andamento (evita pedir a mesma página duas vezes antes do re-render)
  const inFlightRef = useRef(new Set());

  // Busca as definições de atributos uma única vez
  useEffect(() => {
    let active = true;
    getCustomAttributes()
      .then(attrs => { if (active) setAttributeDefs(attrs); })
      .catch(err => { if (active) { setError(err); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const listAttributes = useMemo(
    () => (attributeDefs || []).filter(a => a.attribute_display_type === 'list' && a.attribute_values?.length),
    [attributeDefs]
  );

  const attribute = useMemo(() => {
    const selected = selectAttribute(attributeDefs || [], param, readAttributeCookie());
    return selected
      ? { attribute_key: selected.attribute_key, attribute_values: selected.attribute_values }
      : null;
  }, [attributeDefs, param]);

  const displayNames = useMemo(() => {
    const map = {};
    (attributeDefs || []).forEach(attr => {
      map[attr.attribute_key] = attr.attribute_display_name || attr.attribute_key;
    });
    return map;
  }, [attributeDefs]);

  const attributeKey = attribute?.attribute_key;

  // Lembra o atributo exibido (vindo da URL ou do dropdown) para a próxima visita
  useEffect(() => {
    if (attributeKey) saveAttributeCookie(attributeKey);
  }, [attributeKey]);

  // Se o atributo "kanbanwoot" existe na conta, só entram no board os contatos marcados com ele
  const onlyFlagged = useMemo(
    () => (attributeDefs || []).some(a => a.attribute_key === KANBANWOOT_FLAG_KEY),
    [attributeDefs]
  );
  const columns = useMemo(
    () => (attribute ? [UNASSIGNED_STAGE, ...attribute.attribute_values] : []),
    [attribute]
  );

  // Carrega a próxima página de uma coluna
  const loadMore = useCallback(async (stage) => {
    const col = boardRef.current[stage];
    if (!attributeKey || !col || col.loading || !col.hasMore || inFlightRef.current.has(stage)) return;
    inFlightRef.current.add(stage);
    const generation = generationRef.current;
    const page = col.page + 1;
    dispatch({ type: 'STAGE_LOADING', payload: { stage } });
    try {
      const { contacts, count } = await getContactsByStage(attributeKey, stage, page, { onlyFlagged });
      if (generation !== generationRef.current) return;
      dispatch({ type: 'STAGE_LOADED', payload: { stage, page, contacts, count } });
    } catch (err) {
      if (generation !== generationRef.current) return;
      console.error('[DEBUG] Erro ao carregar coluna:', stage, err);
      dispatch({ type: 'STAGE_ERROR', payload: { stage, error: err } });
    } finally {
      if (generation === generationRef.current) inFlightRef.current.delete(stage);
    }
  }, [attributeKey, onlyFlagged]);

  // Ao trocar de atributo: zera o board e carrega a 1ª página de cada coluna em paralelo
  useEffect(() => {
    if (!attributeDefs) return;
    if (!attributeKey) {
      setLoading(false);
      return;
    }
    generationRef.current += 1;
    inFlightRef.current = new Set();
    dispatch({ type: 'RESET', payload: columns });
    // boardRef é atualizado no próximo render; prepara o estado para o loadMore já agora
    boardRef.current = kanbanReducer({}, { type: 'RESET', payload: columns });
    setLoading(false);
    columns.forEach(stage => loadMore(stage));
  }, [attributeDefs, attributeKey, columns, loadMore]);

  // Move um card: atualização otimista, desfeita se a API falhar
  const moveContact = useCallback(async ({ contactId, source, destination, sourceIndex, destinationIndex }) => {
    if (source === destination) {
      dispatch({ type: 'MOVE_CARD', payload: { source, destination, contactId, index: destinationIndex } });
      return;
    }
    const contact = boardRef.current[source]?.contacts.find(c => c.id === contactId);
    const previousValue = contact?.custom_attributes?.[attributeKey];
    const value = destination === UNASSIGNED_STAGE ? undefined : destination;
    if (typeof value !== 'undefined' && !attribute.attribute_values.includes(value)) {
      throw new Error(`Valor inválido para coluna: "${value}"`);
    }
    dispatch({
      type: 'MOVE_CARD',
      payload: { source, destination, contactId, index: destinationIndex, attributeKey, value }
    });
    try {
      if (typeof value === 'undefined') {
        await removeContactCustomAttributes(contactId, [attributeKey]);
      } else {
        await updateContactCustomAttribute(contactId, attributeKey, value);
      }
    } catch (err) {
      dispatch({
        type: 'MOVE_CARD',
        payload: { source: destination, destination: source, contactId, index: sourceIndex, attributeKey, value: previousValue }
      });
      throw err;
    }
  }, [attribute, attributeKey]);

  return { board, columns, attribute, listAttributes, displayNames, loading, error, loadMore, moveContact };
}
