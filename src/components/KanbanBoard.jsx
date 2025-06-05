import React, { useEffect, useState, useRef, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { getContactsFiltered, updateKanbanStage, getKanbanStages, getListAttributes } from '../api';
import { debugLog } from '../debug';
import KanbanColumn from './KanbanColumn';

function KanbanBoard() {
  const [columns, setColumns] = useState({});
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listAttributes, setListAttributes] = useState([]);
  const [selectedAttr, setSelectedAttr] = useState('');
  const [contacts, setContacts] = useState([]); // todos os contatos carregados
  const [contactsCache, setContactsCache] = useState({}); // {stage: [contatos]}
  const [visibleByStage, setVisibleByStage] = useState({}); // {stage: quantos mostrar}
  const [pageByStage, setPageByStage] = useState({}); // {stage: pagina atual}
  const [hasMoreByStage, setHasMoreByStage] = useState({}); // {stage: boolean}
  const [metaByStage, setMetaByStage] = useState({}); // {stage: {count, current_page}}
  const [loadingMoreByStage, setLoadingMoreByStage] = useState({}); // {stage: boolean}
  const INCREMENT = 15;
  const loadingRefByStage = useRef({});

  useEffect(() => {
    // Carrega atributos do tipo lista para o dropdown
    getListAttributes().then(attrs => {
      setListAttributes(attrs);
      if (attrs.length && !selectedAttr) setSelectedAttr(attrs[0].attribute_key);
    });
  }, []);

  // Carrega estágios e reseta tudo ao trocar de funil
  useEffect(() => {
    if (!selectedAttr) return;
    setContactsCache({});
    setVisibleByStage({});
    setPageByStage({});
    setHasMoreByStage({});
    setMetaByStage({});
    setLoading(true);
    debugLog('KanbanBoard montado');
    getKanbanStages(selectedAttr).then(kanbanStages => {
      setStages(kanbanStages);
      setLoading(false);
    });
  }, [selectedAttr]);

  // Função para buscar contatos de uma página (sem filtro de coluna)
  const fetchContactsPage = useCallback(async (page) => {
    setLoading(true);
    const data = await getContactsFiltered(page, 15, selectedAttr);
    setContacts(prev => ([...prev, ...(data.payload || [])]));
    setMetaByStage(prev => ({ ...prev, all: data.meta || { count: (prev.all?.count || 0), current_page: page } }));
    setLoading(false);
  }, [selectedAttr]);

  // Handler para carregar mais contatos globais
  const handleLoadMore = useCallback(() => {
    if ((contacts.length || 0) < (metaByStage.all?.count || 999999)) {
      const nextPage = (metaByStage.all?.current_page || 1) + 1;
      fetchContactsPage(nextPage);
    }
  }, [contacts, metaByStage, fetchContactsPage]);

  // Carrega a primeira página ao montar
  useEffect(() => {
    setContacts([]);
    setMetaByStage({});
    fetchContactsPage(1);
  }, [selectedAttr, fetchContactsPage]);

  // Função utilitária para buscar contatos de uma coluna/página (lógica de dados separada)
  async function fetchContactsForStage({ page, selectedAttr, stage }) {
    debugLog('[KanbanBoard] fetchContactsForStage', { page, selectedAttr, stage });
    // Para "Não Atribuído", buscar contatos sem valor definido para o atributo
    const isUnassigned = stage === 'Não Atribuído';
    const result = await getContactsFiltered(page, 15, selectedAttr, isUnassigned ? null : stage);
    debugLog('[KanbanBoard] Resultado getContactsFiltered', { page, selectedAttr, stage, result });
    return result;
  }

  // Função para buscar contatos de uma coluna/página (chama utilitária)
  const fetchStagePage = useCallback(async (stage, page) => {
    if (loadingRefByStage.current[stage]) return;
    loadingRefByStage.current[stage] = true;
    setLoadingMoreByStage(prev => ({ ...prev, [stage]: true }));
    try {
      const data = await fetchContactsForStage({ page, selectedAttr, stage });
      debugLog('[KanbanBoard] fetchStagePage', {
        stage,
        page,
        payloadLength: data.payload?.length,
        meta: data.meta,
        payload: data.payload
      });
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
      setMetaByStage(prev => ({
        ...prev,
        [stage]: data.meta || { count: (prev[stage]?.count || 0), current_page: page }
      }));
      setHasMoreByStage(prev => ({
        ...prev,
        [stage]: (data.payload?.length > 0) && ((data.meta?.count || 0) > ((data.meta?.current_page || 1) * 15))
      }));
      // Só incrementa página/visibilidade se realmente veio dado novo
      setPageByStage(prev => ({ ...prev, [stage]: page }));
      setVisibleByStage(prev => ({ ...prev, [stage]: (prev[stage] || INCREMENT) + INCREMENT }));
    } finally {
      setLoadingMoreByStage(prev => ({ ...prev, [stage]: false }));
      loadingRefByStage.current[stage] = false;
    }
  }, [selectedAttr]);

  const onDragEnd = async ({ source, destination }) => {
    debugLog('DragEnd', { source, destination });
    if (!destination) return;

    const sourceList = Array.from(columns[source.droppableId]);
    const [moved] = sourceList.splice(source.index, 1);
    const destList = Array.from(columns[destination.droppableId] || []);
    destList.splice(destination.index, 0, moved);

    const updatedColumns = {
      ...columns,
      [source.droppableId]: sourceList,
      [destination.droppableId]: destList
    };

    const prevColumns = columns;
    setColumns(updatedColumns);

    try {
      await updateKanbanStage(moved.id, destination.droppableId, selectedAttr);
    } catch (err) {
      setColumns(prevColumns);
      alert("Erro ao atualizar estágio no Chatwoot.");
    }
  };

  // Handler para carregar mais em uma coluna (infinite scroll)
  const handleLoadMoreInColumn = useCallback((stage) => {
    if (loadingRefByStage.current[stage] || loadingMoreByStage[stage] || !hasMoreByStage[stage]) return;
    const nextPage = (pageByStage[stage] || 1) + 1;
    fetchStagePage(stage, nextPage);
  }, [loadingMoreByStage, hasMoreByStage, pageByStage, fetchStagePage]);

  // Carrega a primeira página de cada coluna ao montar ou ao trocar de funil
  useEffect(() => {
    if (!stages.length) return;
    // Inicializa controles por coluna
    setVisibleByStage(stages.reduce((acc, stage) => { acc[stage] = INCREMENT; return acc; }, {}));
    setPageByStage(stages.reduce((acc, stage) => { acc[stage] = 1; return acc; }, {}));
    setHasMoreByStage(stages.reduce((acc, stage) => { acc[stage] = true; return acc; }, {}));
    setContactsCache(stages.reduce((acc, stage) => { acc[stage] = []; return acc; }, {}));
    setMetaByStage(stages.reduce((acc, stage) => { acc[stage] = { count: 0, current_page: 1 }; return acc; }, {}));
    // Limpa refs de loading
    loadingRefByStage.current = {};
    // Só depois de inicializar, carrega a primeira página de cada coluna
    stages.forEach(stage => {
      fetchStagePage(stage, 1);
    });
  }, [stages, fetchStagePage]);

  // Atualiza hasMoreByStage sempre que metaByStage ou contactsCache mudar
  useEffect(() => {
    setHasMoreByStage(prev => {
      const updated = { ...prev };
      stages.forEach(stage => {
        const meta = metaByStage[stage] || {};
        const loaded = (contactsCache[stage]?.length || 0);
        updated[stage] = loaded < (meta.count || 0);
      });
      return updated;
    });
  }, [metaByStage, contactsCache, stages]);

  // Compute attrDisplayNames for the selected attribute (values to display names)
  const attrDisplayNames = React.useMemo(() => {
    const attr = listAttributes.find(a => a.attribute_key === selectedAttr);
    if (!attr) return {};
    // If attribute_values is an array of strings, use them as both key and value
    if (Array.isArray(attr.attribute_values)) {
      const map = {};
      attr.attribute_values.forEach(val => {
        map[val] = val;
      });
      map['Não Atribuído'] = 'Não Atribuído';
      return map;
    }
    return {};
  }, [listAttributes, selectedAttr]);

  if (loading && contacts.length === 0) {
    return <div className="p-4">Carregando Kanban...</div>;
  }

  return (
    <>
      <div className="p-4 flex items-center gap-4">
        <label className="font-medium">Funil:</label>
        <select
          className="border rounded p-2"
          value={selectedAttr}
          onChange={e => setSelectedAttr(e.target.value)}
        >
          {listAttributes.map(attr => (
            <option key={attr.attribute_key} value={attr.attribute_key}>
              {attr.attribute_display_name || attr.attribute_key}
            </option>
          ))}
        </select>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 p-6 overflow-x-auto bg-gray-50 min-h-screen">
          {stages.map(stage => {
            debugLog('[KanbanBoard] Renderizando coluna', {
              stage,
              contacts: contactsCache[stage],
              visible: visibleByStage[stage],
              meta: metaByStage[stage],
              hasMore: hasMoreByStage[stage],
              loadingMore: loadingMoreByStage[stage]
            });
            return (
              <KanbanColumn
                key={stage}
                stage={stage}
                contacts={(contactsCache[stage] || []).slice(0, visibleByStage[stage] || INCREMENT)}
                attrDisplayNames={attrDisplayNames}
                onLoadMore={() => handleLoadMoreInColumn(stage)}
                hasMore={hasMoreByStage[stage]}
                loadingMore={loadingMoreByStage[stage]}
              />
            );
          })}
        </div>
      </DragDropContext>
    </>
  );
}

export default KanbanBoard;
