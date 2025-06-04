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
  const [contactsCache, setContactsCache] = useState([]); // cache global
  const [visibleByStage, setVisibleByStage] = useState({}); // quantos mostrar por coluna
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loaderRef = useRef(null);
  const PAGE_SIZE = 100; // tamanho do lote para cache
  const INCREMENT = 15; // quantos mostrar por vez por coluna

  useEffect(() => {
    // Carrega atributos do tipo lista para o dropdown
    getListAttributes().then(attrs => {
      setListAttributes(attrs);
      if (attrs.length && !selectedAttr) setSelectedAttr(attrs[0].attribute_key);
    });
  }, []);

  // Carrega estágios e reseta contatos ao trocar de funil
  useEffect(() => {
    if (!selectedAttr) return;
    setContacts([]);
    setContactsCache([]);
    setVisibleByStage({});
    setPage(1);
    setHasMore(true);
    setLoading(true);
    debugLog('KanbanBoard montado');
    getKanbanStages(selectedAttr).then(kanbanStages => {
      setStages(kanbanStages);
      setLoading(false);
    });
  }, [selectedAttr]);

  // Carrega contatos em lote para o cache
  useEffect(() => {
    if (!selectedAttr || !hasMore || loadingMore) return;
    setLoadingMore(true);
    getContactsFiltered(page, PAGE_SIZE).then(newContacts => {
      setContactsCache(prev => {
        // Evita duplicatas
        const ids = new Set(prev.map(c => c.id));
        return [...prev, ...newContacts.filter(c => !ids.has(c.id))];
      });
      if (newContacts.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setLoadingMore(false);
    });
  }, [page, selectedAttr]);

  // Inicializa quantos mostrar por coluna
  useEffect(() => {
    if (!stages.length) return;
    setVisibleByStage(stages.reduce((acc, stage) => {
      acc[stage] = INCREMENT;
      return acc;
    }, {}));
  }, [stages]);

  // Atualiza contatos visíveis conforme cache e visibleByStage
  useEffect(() => {
    if (!stages.length) return;
    const organized = stages.reduce((acc, stage) => {
      acc[stage] = [];
      return acc;
    }, {});
    contactsCache.forEach(contact => {
      const stage = contact.custom_attributes?.[selectedAttr];
      const col = stage && stages.includes(stage) ? stage : 'Não Atribuído';
      if (!organized[col]) organized[col] = [];
      organized[col].push(contact);
    });
    // Aplica o limite de visibilidade por coluna
    const limited = {};
    for (const stage of stages) {
      limited[stage] = organized[stage]?.slice(0, visibleByStage[stage] || INCREMENT) || [];
    }
    setColumns(limited);
  }, [contactsCache, stages, selectedAttr, visibleByStage]);

  // Infinite scroll com IntersectionObserver
  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const observer = new window.IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loadingMore) {
          setPage(p => p + 1);
        }
      },
      { root: null, rootMargin: '0px', threshold: 0.1 }
    );
    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }
    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [hasMore, loadingMore, loaderRef.current]);

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

  // Handler para carregar mais em uma coluna
  const handleLoadMoreInColumn = useCallback((stage) => {
    setVisibleByStage(prev => ({
      ...prev,
      [stage]: (prev[stage] || INCREMENT) + INCREMENT
    }));
    // Se o cache estiver acabando, busca mais
    const totalVisiveis = Object.values(visibleByStage).reduce((a, b) => a + b, 0);
    if (contactsCache.length - totalVisiveis < INCREMENT * stages.length && hasMore && !loadingMore) {
      setPage(p => p + 1);
    }
  }, [contactsCache.length, hasMore, loadingMore, stages.length, visibleByStage]);

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
          {stages.map(stage => (
            <KanbanColumn
              key={stage}
              stage={stage}
              contacts={columns[stage] || []}
              attrDisplayNames={attrDisplayNames}
              onLoadMore={() => handleLoadMoreInColumn(stage)}
              hasMore={columns[stage]?.length > (visibleByStage[stage] || INCREMENT)}
            />
          ))}
          {/* Loader sentinel para IntersectionObserver */}
          {hasMore && <div ref={loaderRef} style={{ minWidth: 40, minHeight: 40 }} />}
        </div>
        {loadingMore && (
          <div className="w-full text-center py-4 text-gray-500">Carregando mais contatos...</div>
        )}
      </DragDropContext>
    </>
  );
}

export default KanbanBoard;
