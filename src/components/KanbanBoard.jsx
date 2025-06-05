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
    setLoadingMoreByStage(prev => ({ ...prev, [stage]: true }));
    const data = await fetchContactsForStage({ page, selectedAttr, stage });
    debugLog('[KanbanBoard] fetchStagePage', {
      stage,
      page,
      payloadLength: data.payload?.length,
      meta: data.meta
    });
    setContactsCache(prev => ({
      ...prev,
      [stage]: [...(prev[stage] || []), ...(data.payload || [])]
    }));
    setMetaByStage(prev => ({
      ...prev,
      [stage]: data.meta || { count: (prev[stage]?.count || 0), current_page: page }
    }));
    // Corrige cálculo de hasMoreByStage
    setHasMoreByStage(prev => ({
      ...prev,
      [stage]: (data.payload?.length > 0) && ((data.meta?.count || 0) > ((data.meta?.current_page || 1) * 15))
    }));
    setLoadingMoreByStage(prev => ({ ...prev, [stage]: false }));
  }, [selectedAttr]);

  // Handler para carregar mais em uma coluna
  const handleLoadMoreInColumn = useCallback((stage) => {
    setVisibleByStage(prev => ({ ...prev, [stage]: (prev[stage] || INCREMENT) + INCREMENT }));
    // Se já carregou tudo do cache, busca próxima página
    if ((contactsCache[stage]?.length || 0) < (metaByStage[stage]?.count || 999999) && hasMoreByStage[stage]) {
      const nextPage = (pageByStage[stage] || 1) + 1;
      setPageByStage(prev => ({ ...prev, [stage]: nextPage }));
      fetchStagePage(stage, nextPage);
    }
  }, [contactsCache, metaByStage, hasMoreByStage, pageByStage, fetchStagePage]);

  // Carrega a primeira página de cada coluna ao montar
  useEffect(() => {
    stages.forEach(stage => {
      if ((contactsCache[stage]?.length || 0) === 0 && hasMoreByStage[stage]) {
        fetchStagePage(stage, 1);
      }
    });
  }, [stages, fetchStagePage, contactsCache, hasMoreByStage]);

  // Inicializa controles por coluna
  useEffect(() => {
    if (!stages.length) return;
    setVisibleByStage(stages.reduce((acc, stage) => { acc[stage] = INCREMENT; return acc; }, {}));
    setPageByStage(stages.reduce((acc, stage) => { acc[stage] = 1; return acc; }, {}));
    setHasMoreByStage(stages.reduce((acc, stage) => { acc[stage] = true; return acc; }, {}));
    setContactsCache(stages.reduce((acc, stage) => { acc[stage] = []; return acc; }, {}));
    setMetaByStage(stages.reduce((acc, stage) => { acc[stage] = { count: 0, current_page: 1 }; return acc; }, {}));
  }, [stages]);

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
