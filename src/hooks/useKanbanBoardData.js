import { useState, useRef, useCallback, useEffect } from 'react';
import { getContactsFiltered, getKanbanStages, getListAttributes, updateKanbanStage } from '../api';
import { debugLog } from '../debug';

const INCREMENT = 15;

export function useKanbanBoardData() {
  const [listAttributes, setListAttributes] = useState([]);
  const [selectedAttr, setSelectedAttr] = useState('');
  const [stages, setStages] = useState([]);
  const [contactsCache, setContactsCache] = useState({});
  const [pageByStage, setPageByStage] = useState({});
  const [hasMoreByStage, setHasMoreByStage] = useState({});
  const [loadingByStage, setLoadingByStage] = useState({});
  const [metaByStage, setMetaByStage] = useState({});
  const loadingRef = useRef({});
  const [loading, setLoading] = useState(true);

  // Carrega atributos do tipo lista para o dropdown
  useEffect(() => {
    getListAttributes().then(attrs => {
      setListAttributes(attrs);
      if (attrs.length && !selectedAttr) setSelectedAttr(attrs[0].attribute_key);
    });
  }, []);

  // Carrega estágios e reseta tudo ao trocar de funil
  useEffect(() => {
    if (!selectedAttr) return;
    setContactsCache({});
    setPageByStage({});
    setHasMoreByStage({});
    setMetaByStage({});
    setLoading(true);
    getKanbanStages(selectedAttr).then(kanbanStages => {
      setStages(kanbanStages);
      setLoading(false);
    });
  }, [selectedAttr]);

  // Carrega a primeira página de cada coluna ao montar ou ao trocar de funil
  useEffect(() => {
    if (!stages.length) return;
    setContactsCache(stages.reduce((acc, stage) => { acc[stage] = []; return acc; }, {}));
    setPageByStage(stages.reduce((acc, stage) => { acc[stage] = 1; return acc; }, {}));
    setHasMoreByStage(stages.reduce((acc, stage) => { acc[stage] = true; return acc; }, {}));
    setMetaByStage(stages.reduce((acc, stage) => { acc[stage] = { count: 0, current_page: 1 }; return acc; }, {}));
    loadingRef.current = {};
    stages.forEach(stage => {
      loadStagePage(stage, 1);
    });
  }, [stages, selectedAttr]);

  const loadStagePage = useCallback(async (stage, page) => {
    if (loadingRef.current[stage]) return;
    loadingRef.current[stage] = true;
    setLoadingByStage(prev => ({ ...prev, [stage]: true }));
    try {
      const isUnassigned = stage === 'Não Atribuído';
      const data = await getContactsFiltered(page, INCREMENT, selectedAttr, isUnassigned ? null : stage);
      setContactsCache(prev => {
        const newCache = { ...prev };
        const newContacts = (data.payload || []);
        const newIds = new Set(newContacts.map(c => c.id));
        Object.keys(newCache).forEach(col => {
          if (col !== stage) {
            newCache[col] = (newCache[col] || []).filter(c => !newIds.has(c.id));
          }
        });
        newCache[stage] = [...(newCache[stage] || []), ...newContacts.filter(c => !(newCache[stage] || []).some(e => e.id === c.id))];
        return newCache;
      });
      setMetaByStage(prev => ({ ...prev, [stage]: data.meta || { count: (prev[stage]?.count || 0), current_page: page } }));
      setHasMoreByStage(prev => ({ ...prev, [stage]: (data.payload?.length > 0) && ((data.meta?.count || 0) > ((data.meta?.current_page || 1) * INCREMENT)) }));
      setPageByStage(prev => ({ ...prev, [stage]: page }));
    } finally {
      setLoadingByStage(prev => ({ ...prev, [stage]: false }));
      loadingRef.current[stage] = false;
    }
  }, [selectedAttr]);

  const loadMore = useCallback((stage) => {
    if (loadingRef.current[stage] || loadingByStage[stage] || !hasMoreByStage[stage]) return;
    const nextPage = (pageByStage[stage] || 1) + 1;
    loadStagePage(stage, nextPage);
  }, [loadingByStage, hasMoreByStage, pageByStage, loadStagePage]);

  // Função para drag and drop
  const moveCard = async (contactId, fromStage, toStage) => {
    await updateKanbanStage(contactId, toStage, selectedAttr);
    // Após mover, recarrega as duas colunas
    loadStagePage(fromStage, 1);
    loadStagePage(toStage, 1);
  };

  // Nomes amigáveis dos valores
  const attrDisplayNames = (() => {
    const attr = listAttributes.find(a => a.attribute_key === selectedAttr);
    if (!attr) return {};
    const map = {};
    (attr.attribute_values || []).forEach(val => { map[val] = val; });
    map['Não Atribuído'] = 'Não Atribuído';
    return map;
  })();

  return {
    listAttributes,
    selectedAttr,
    setSelectedAttr,
    stages,
    contactsCache,
    hasMoreByStage,
    loadingByStage,
    loadMore,
    moveCard,
    attrDisplayNames,
    loading
  };
}
