import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getContacts, updateKanbanStage, getKanbanStages } from '../api';
import { debugLog } from '../debug';

function KanbanBoard() {
  const [columns, setColumns] = useState({});
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    debugLog('KanbanBoard montado');
    const fetchData = async () => {
      try {
        debugLog('Buscando estágios e contatos...');
        const [kanbanStages, contacts] = await Promise.all([
          getKanbanStages(),
          getContacts()
        ]);
        setStages(kanbanStages);

        debugLog('Estágios:', kanbanStages, 'Contatos:', contacts);

        const organized = kanbanStages.reduce((acc, stage) => {
          acc[stage] = [];
          return acc;
        }, {});

        contacts.forEach(contact => {
          const stage = contact.custom_attributes?.kanban || kanbanStages[0];
          if (!organized[stage]) organized[stage] = [];
          organized[stage].push(contact);
        });

        setColumns(organized);
        setLoading(false);
      } catch (err) {
        debugLog('Erro ao buscar dados do Kanban:', err);
        // Mostra erro na tela
        setLoading(false);
        setStages([]);
        setColumns({});
        alert('Erro ao carregar dados do Kanban. Veja o console para detalhes.');
      }
    };
    fetchData();
  }, []);

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
      await updateKanbanStage(moved.id, destination.droppableId);
    } catch (err) {
      setColumns(prevColumns);
      alert("Erro ao atualizar estágio no Chatwoot.");
    }
  };

  if (loading) {
    return <div className="p-4">Carregando Kanban...</div>;
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-6 p-6 overflow-x-auto bg-gray-50 min-h-screen">
        {stages.map(stage => (
          <Droppable key={stage} droppableId={stage}>
            {(provided) => (
              <div
                className="bg-gray-100 p-4 rounded w-80 min-h-[300px]"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                <h2 className="text-lg font-bold mb-2">{stage}</h2>
                {columns[stage]?.map((contact, index) => (
                  <Draggable key={contact.id} draggableId={String(contact.id)} index={index}>
                    {(provided) => (
                      <div
                        className="bg-white p-3 mb-2 rounded shadow"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        {contact.name || contact.email || `Contato #${contact.id}`}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}

export default KanbanBoard;
