import { useState, useEffect, useCallback } from 'react';
import { getContactsFiltered, getKanbanStages, getListAttributes, updateKanbanStage, getConnectionParam, setCookie } from '../api';
import { debugLog } from '../debug';

export function useKanbanBoardData() {
  const [listAttributes, setListAttributes] = useState([]);
  const [selectedAttr, setSelectedAttr] = useState('');
  const [stages, setStages] = useState([]);
  const [contacts, setContacts] = useState([]); // todos os contatos
  const [kanbanMatrix, setKanbanMatrix] = useState({}); // {stage: [contatos]}
  const [loading, setLoading] = useState(true);
  const [loadingSync, setLoadingSync] = useState(false);

  // Inicializa selectedAttr a partir da querystring, cookie ou valor padrão
  useEffect(() => {
    debugLog('[KanbanDebug] useEffect getListAttributes iniciado');
    getListAttributes().then(attrs => {
      debugLog('[KanbanDebug] Atributos carregados:', attrs);
      setListAttributes(attrs);
      if (!attrs.length) {
        debugLog('[KanbanDebug] Nenhum atributo do tipo lista disponível!');
        setSelectedAttr('');
        setStages([]);
        setKanbanMatrix({});
        setLoading(false);
        debugLog('Nenhum atributo do tipo lista disponível. Configure um campo customizado do tipo lista no Chatwoot.');
        return;
      }
      // Busca valor inicial do atributo (querystring > cookie > primeiro disponível)
      let initialAttr = '';
      let kbw = getConnectionParam('kbw', 'REACT_APP_KBW_ATTR');
      debugLog('[KanbanDebug] Valor kbw detectado:', kbw);
      if (kbw && attrs.some(a => a.attribute_key === kbw)) {
        initialAttr = kbw;
      } else {
        initialAttr = attrs[0].attribute_key;
      }
      debugLog('[KanbanDebug] initialAttr definido:', initialAttr);
      setSelectedAttr(initialAttr);
      setCookie('kbw', initialAttr); // Salva no cookie sempre
    });
  }, []);

  // Sempre que selectedAttr mudar, salva no cookie e recarrega estágios e contatos
  useEffect(() => {
    debugLog('[KanbanDebug] useEffect selectedAttr mudou:', selectedAttr);
    if (!selectedAttr) return;
    setCookie('kbw', selectedAttr); // Salva no cookie
    setLoading(true);
    setKanbanMatrix({}); // Zera matriz ANTES de buscar estágios
    setStages([]);
    getKanbanStages(selectedAttr).then(kanbanStages => {
      debugLog('[KanbanDebug] Stages carregados:', kanbanStages);
      setStages(kanbanStages);
    });
  }, [selectedAttr]);

  // Função para carregar todos os contatos e montar matriz
  const loadAllContacts = useCallback(async () => {
    setKanbanMatrix({});
    setLoading(true);
    let allContacts = [];
    let page = 1;
    let keepGoing = true;
    while (keepGoing) {
      debugLog(`[KanbanDebug] Buscando contatos página ${page}`);
      const { payload, meta } = await getContactsFiltered(page, 100, selectedAttr);
      debugLog(`[KanbanDebug] Página ${page} retornou`, payload?.length, 'contatos', meta);
      allContacts = allContacts.concat(payload || []);
      if (!meta || !meta.count || allContacts.length >= meta.count) {
        keepGoing = false;
      } else {
        page++;
      }
    }
    debugLog('[KanbanDebug] Todos os contatos carregados:', allContacts.length);
    setContacts(allContacts);
    // Monta matriz espelho
    const matrix = {};
    stages.forEach(stage => { matrix[stage] = []; });
    allContacts.forEach(contact => {
      const value = contact.custom_attributes?.[selectedAttr];
      let col = value;
      if (!col || !stages.includes(col)) col = 'Não Atribuído';
      if (!matrix[col]) matrix[col] = [];
      matrix[col].push(contact);
    });
    debugLog('[KanbanDebug] Matriz final:', matrix);
    setKanbanMatrix(matrix);
    setLoading(false);
  }, [selectedAttr, stages]);

  // Sempre que stages mudar, zera matriz e recarrega todos os contatos e monta matriz
  useEffect(() => {
    debugLog('[KanbanDebug] useEffect para carregar contatos', { selectedAttr, stages });
    setKanbanMatrix({}); // Zera matriz ANTES de carregar contatos
    if (!selectedAttr || !stages.length) return;
    loadAllContacts();
  }, [selectedAttr, stages, loadAllContacts]);

  // Drag & drop: move contato na matriz local e sincroniza com API
  const moveCard = useCallback(async (contactId, fromStage, toStage) => {
    debugLog('[KanbanDebug] moveCard', { contactId, fromStage, toStage, selectedAttr });
    setLoadingSync(true);
    // Atualiza matriz local otimisticamente
    setKanbanMatrix(prev => {
      const newMatrix = { ...prev };
      const contact = (newMatrix[fromStage] || []).find(c => c.id === contactId);
      if (!contact) return prev;
      newMatrix[fromStage] = (newMatrix[fromStage] || []).filter(c => c.id !== contactId);
      newMatrix[toStage] = [ ...(newMatrix[toStage] || []), { ...contact, custom_attributes: { ...contact.custom_attributes, [selectedAttr]: toStage === 'Não Atribuído' ? undefined : toStage } } ];
      debugLog('[KanbanDebug] Matriz após moveCard:', newMatrix);
      return newMatrix;
    });
    // Sincroniza com API e SEMPRE recarrega matriz após resposta
    try {
      await updateKanbanStage(contactId, toStage === 'Não Atribuído' ? undefined : toStage, selectedAttr);
    } catch (e) {
      debugLog('Erro ao sincronizar drag & drop', e);
    } finally {
      await loadAllContacts(); // Sempre recarrega para garantir consistência
      setLoadingSync(false);
    }
  }, [selectedAttr, loadAllContacts]);

  // Nomes amigáveis dos valores das colunas
  const attrDisplayNames = (() => {
    debugLog('[KanbanDebug] attrDisplayNames calculando', { listAttributes, selectedAttr });
    const attr = listAttributes.find(a => a.attribute_key === selectedAttr);
    if (!attr) return {};
    const map = {};
    // Se o atributo tem um mapeamento de nomes amigáveis para os valores
    if (attr.attribute_value_display_names && typeof attr.attribute_value_display_names === 'object') {
      Object.entries(attr.attribute_value_display_names).forEach(([val, display]) => {
        map[val] = display || val;
      });
    } else if (Array.isArray(attr.attribute_values)) {
      attr.attribute_values.forEach(val => { map[val] = val; });
    }
    map['Não Atribuído'] = 'Não Atribuído';
    debugLog('[KanbanDebug] attrDisplayNames:', map);
    return map;
  })();

  // Função para reload manual
  const reloadKanban = useCallback(() => {
    loadAllContacts();
  }, [loadAllContacts]);

  return {
    listAttributes,
    selectedAttr,
    setSelectedAttr,
    stages,
    kanbanMatrix,
    moveCard,
    attrDisplayNames,
    loading,
    loadingSync,
    reloadKanban
  };
}
