import React from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import KanbanColumn from './KanbanColumn';
import { useKanbanBoardData } from '../hooks/useKanbanBoardData';

export default function KanbanBoard() {
  const {
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
  } = useKanbanBoardData();

  const onDragEnd = async ({ source, destination }) => {
    if (!destination) return;
    const fromStage = source.droppableId;
    const toStage = destination.droppableId;
    const contact = (kanbanMatrix[fromStage] || [])[source.index];
    if (!contact) return;
    await moveCard(contact.id, fromStage, toStage);
  };

  if (loading) {
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
        <button className="ml-4 px-3 py-1 rounded bg-blue-500 text-white" onClick={reloadKanban} disabled={loading || loadingSync}>
          Recarregar
        </button>
        {loadingSync && <span className="ml-2 text-blue-600 animate-pulse">Sincronizando...</span>}
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 p-6 overflow-x-auto bg-gray-50 min-h-screen">
          {stages.map(stage => (
            <KanbanColumn
              key={stage}
              stage={stage}
              contacts={kanbanMatrix[stage] || []}
              attrDisplayNames={attrDisplayNames}
              // Infinite scroll removido: todos os contatos já estão em memória
              onLoadMore={null}
              hasMore={false}
              loadingMore={false}
            />
          ))}
        </div>
      </DragDropContext>
    </>
  );
}
