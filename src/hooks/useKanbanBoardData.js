import { useState, useEffect, useCallback } from 'react';
import { getContactsFiltered, getKanbanStages, getListAttributes, updateKanbanStage, getConnectionParam } from '../api';
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
    getListAttributes().then(attrs => {
      setListAttributes(attrs);
      if (!attrs.length) {
        // Aviso se não houver nenhum atributo do tipo lista
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
      if (kbw && attrs.some(a => a.attribute_key === kbw)) {
        initialAttr = kbw;
      } else {
        initialAttr = attrs[0].attribute_key;
      }
      setSelectedAttr(prev => prev || initialAttr);
    });
  }, []);

  // Carrega estágios ao trocar de funil
  useEffect(() => {
    if (!selectedAttr) return;
    setLoading(true);
    setKanbanMatrix({}); // Limpa matriz ao trocar de atributo
    setStages([]); // Limpa colunas ao trocar de atributo
    getKanbanStages(selectedAttr).then(kanbanStages => {
      setStages(kanbanStages);
      // O carregamento de contatos será disparado pelo próximo useEffect
      setLoading(false);
    });
  }, [selectedAttr]);

  // Carrega todos os contatos em background e monta matriz
  useEffect(() => {
    if (!selectedAttr || !stages.length) return;
    setKanbanMatrix({}); // Limpa matriz ao trocar de colunas
    loadAllContacts();
  }, [selectedAttr, stages, loadAllContacts]);

  const loadAllContacts = useCallback(async () => {
    setLoading(true);
    let allContacts = [];
    let page = 1;
    let keepGoing = true;
    while (keepGoing) {
      const { payload, meta } = await getContactsFiltered(page, 100, selectedAttr);
      allContacts = allContacts.concat(payload || []);
      if (!meta || !meta.count || allContacts.length >= meta.count) {
        keepGoing = false;
      } else {
        page++;
      }
    }
    setContacts(allContacts);
    setLoading(false);
    // Monta matriz espelho
    buildMatrix(allContacts, stages, selectedAttr);
  }, [selectedAttr, stages]);

  // Monta matriz espelho a partir dos contatos e estágios
  const buildMatrix = useCallback((allContacts, allStages, attrKey) => {
    const matrix = {};
    allStages.forEach(stage => { matrix[stage] = []; });
    allContacts.forEach(contact => {
      const value = contact.custom_attributes?.[attrKey];
      let col = value;
      if (!col || !allStages.includes(col)) col = 'Não Atribuído';
      if (!matrix[col]) matrix[col] = [];
      matrix[col].push(contact);
    });
    setKanbanMatrix(matrix);
  }, []);

  // Drag & drop: move contato na matriz local e sincroniza com API
  const moveCard = useCallback(async (contactId, fromStage, toStage) => {
    setLoadingSync(true);
    // Atualiza matriz local otimisticamente
    setKanbanMatrix(prev => {
      const newMatrix = { ...prev };
      const contact = (newMatrix[fromStage] || []).find(c => c.id === contactId);
      if (!contact) return prev;
      newMatrix[fromStage] = (newMatrix[fromStage] || []).filter(c => c.id !== contactId);
      newMatrix[toStage] = [ ...(newMatrix[toStage] || []), { ...contact, custom_attributes: { ...contact.custom_attributes, [selectedAttr]: toStage === 'Não Atribuído' ? undefined : toStage } } ];
      return newMatrix;
    });
    // Sincroniza com API
    try {
      await updateKanbanStage(contactId, toStage === 'Não Atribuído' ? undefined : toStage, selectedAttr);
      // Não recarrega todos os contatos após sync
    } catch (e) {
      debugLog('Erro ao sincronizar drag & drop', e);
      // Em caso de erro, recarrega tudo para garantir consistência
      await loadAllContacts();
    } finally {
      setLoadingSync(false);
    }
  }, [selectedAttr, loadAllContacts]);

  // Nomes amigáveis dos valores
  const attrDisplayNames = (() => {
    const attr = listAttributes.find(a => a.attribute_key === selectedAttr);
    if (!attr) return {};
    const map = {};
    (attr.attribute_values || []).forEach(val => { map[val] = val; });
    map['Não Atribuído'] = 'Não Atribuído';
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
