import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import {
  getContactsByStage,
  getCustomAttributes,
  updateContactCustomAttributes,
  getLabels,
  stageSinceKey,
  stageReasonKey,
  stageOutcome,
  VALUE_ATTRIBUTE,
  REFRESH_SECONDS,
  removeContactCustomAttributes,
  UNASSIGNED_STAGE,
  KANBANWOOT_FLAG_KEY,
  AUTH_MODE,
  getCurrentAgent
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
  // Atualização ao vivo: muda a cada movimentação ou página carregada, para descartar uma
  // atualização que começou antes e ficou desatualizada
  const changeVersionRef = useRef(0);
  const movesInFlightRef = useRef(0);
  const refreshingRef = useRef(false);
  // Pausa enquanto o usuário arrasta um card ou está com um diálogo aberto
  const livePausedRef = useRef(false);
  const setLivePaused = useCallback(paused => { livePausedRef.current = paused; }, []);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Filtros do board: busca (nome/telefone/e-mail) e etiqueta
  const [filters, setFilters] = useState({ search: '', label: '' });
  const [labels, setLabels] = useState([]);

  // Agente logado no Chatwoot (só no modo sessão)
  const [agent, setAgent] = useState(null);

  // Modo sessão: confere o agente logado; depois busca as definições de atributos uma única vez
  useEffect(() => {
    let active = true;
    const checkAgent = AUTH_MODE === 'session' ? getCurrentAgent() : Promise.resolve(null);
    checkAgent
      .then(currentAgent => {
        if (active) setAgent(currentAgent);
        return getCustomAttributes();
      })
      .then(attrs => {
        if (!active) return;
        setAttributeDefs(attrs);
        // Etiquetas são opcionais: se falhar, o filtro só fica sem opções
        getLabels()
          .then(list => { if (active) setLabels(list); })
          .catch(err => console.error('[DEBUG] Erro ao carregar etiquetas:', err));
      })
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
      const { contacts, count } = await getContactsByStage(attributeKey, stage, page, { onlyFlagged, ...filters });
      if (generation !== generationRef.current) return;
      changeVersionRef.current += 1;
      dispatch({ type: 'STAGE_LOADED', payload: { stage, page, contacts, count } });
    } catch (err) {
      if (generation !== generationRef.current) return;
      console.error('[DEBUG] Erro ao carregar coluna:', stage, err);
      dispatch({ type: 'STAGE_ERROR', payload: { stage, error: err } });
    } finally {
      if (generation === generationRef.current) inFlightRef.current.delete(stage);
    }
  }, [attributeKey, onlyFlagged, filters]);

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
    setLastRefresh(new Date());
    columns.forEach(stage => loadMore(stage));
  }, [attributeDefs, attributeKey, columns, loadMore]);

  // Atualização ao vivo: rebusca as páginas já carregadas de todas as colunas e troca o board de uma vez
  const refresh = useCallback(async () => {
    if (!attributeKey || refreshingRef.current || livePausedRef.current || movesInFlightRef.current) return;
    const stages = Object.entries(boardRef.current).filter(([, col]) => col.page > 0 && !col.loading);
    if (!stages.length || inFlightRef.current.size) return;
    refreshingRef.current = true;
    const generation = generationRef.current;
    const version = changeVersionRef.current;
    try {
      const results = await Promise.all(stages.map(async ([stage, col]) => {
        const pages = await Promise.all(
          Array.from({ length: col.page }, (_, i) => getContactsByStage(attributeKey, stage, i + 1, { onlyFlagged, ...filters }))
        );
        return [stage, { contacts: pages.flatMap(p => p.contacts), count: pages[0]?.count ?? null }];
      }));
      // Descarta se algo mudou no meio do caminho (troca de atributo, movimentação, nova página, arraste)
      if (generation !== generationRef.current || version !== changeVersionRef.current) return;
      if (livePausedRef.current || movesInFlightRef.current || inFlightRef.current.size) return;
      dispatch({ type: 'REFRESHED', payload: Object.fromEntries(results) });
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[DEBUG] Erro na atualização ao vivo:', err);
    } finally {
      refreshingRef.current = false;
    }
  }, [attributeKey, onlyFlagged, filters]);

  // A cada REFRESH_SECONDS com a aba visível, e logo que a aba volta a ficar visível
  useEffect(() => {
    if (!REFRESH_SECONDS) return undefined;
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_SECONDS * 1000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // Move um card: atualização otimista, desfeita se a API falhar
  // reason: motivo do ganho/perda, quando o destino é uma etapa final; dealValue: valor informado no ganho
  const moveContact = useCallback(async ({ contactId, source, destination, sourceIndex, destinationIndex, reason, dealValue }) => {
    if (source === destination) {
      changeVersionRef.current += 1;
      dispatch({ type: 'MOVE_CARD', payload: { source, destination, contactId, index: destinationIndex } });
      return;
    }
    const contact = boardRef.current[source]?.contacts.find(c => c.id === contactId);
    const sinceKey = stageSinceKey(attributeKey);
    const reasonKey = stageReasonKey(attributeKey);
    const current = contact?.custom_attributes || {};
    const previous = {
      [attributeKey]: current[attributeKey],
      [sinceKey]: current[sinceKey],
      [reasonKey]: current[reasonKey],
      [VALUE_ATTRIBUTE]: current[VALUE_ATTRIBUTE]
    };
    const value = destination === UNASSIGNED_STAGE ? undefined : destination;
    if (typeof value !== 'undefined' && !attribute.attribute_values.includes(value)) {
      throw new Error(`Valor inválido para coluna: "${value}"`);
    }
    // Junto com a etapa, grava quando o contato entrou nela (para o tempo na etapa)
    const next = typeof value === 'undefined'
      ? { [attributeKey]: undefined, [sinceKey]: undefined, [reasonKey]: undefined }
      : { [attributeKey]: value, [sinceKey]: new Date().toISOString() };
    if (typeof value !== 'undefined') {
      const trimmed = (reason || '').trim();
      if (stageOutcome(value) === 'lost' && !trimmed) throw new Error('Informe o motivo da perda.');
      // Fora de etapa final, um motivo antigo é limpo (null: o PUT do Chatwoot não remove chaves)
      if (stageOutcome(value)) next[reasonKey] = trimmed || null;
      else if (current[reasonKey] != null) next[reasonKey] = null;
      if (typeof dealValue === 'number' && Number.isFinite(dealValue)) next[VALUE_ATTRIBUTE] = dealValue;
    }
    changeVersionRef.current += 1;
    movesInFlightRef.current += 1;
    dispatch({
      type: 'MOVE_CARD',
      payload: { source, destination, contactId, index: destinationIndex, attributes: next }
    });
    try {
      if (typeof value === 'undefined') {
        await removeContactCustomAttributes(contactId, [attributeKey, sinceKey, reasonKey]);
      } else {
        await updateContactCustomAttributes(contactId, next);
      }
    } catch (err) {
      dispatch({
        type: 'MOVE_CARD',
        payload: { source: destination, destination: source, contactId, index: sourceIndex, attributes: previous }
      });
      throw err;
    } finally {
      movesInFlightRef.current -= 1;
      changeVersionRef.current += 1;
    }
  }, [attribute, attributeKey]);

  return {
    agent, board, columns, attribute, listAttributes, displayNames, loading, error, loadMore, moveContact,
    filters, setFilters, labels, refresh, lastRefresh, setLivePaused
  };
}
