import React, { useEffect, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { getContacts, updateKanbanStage, getKanbanStages, getListAttributes } from '../api';
import { debugLog } from '../debug';
import KanbanColumn from './KanbanColumn';

function KanbanBoard() {
  const [columns, setColumns] = useState({});
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listAttributes, setListAttributes] = useState([]);
  const [selectedAttr, setSelectedAttr] = useState('');

  useEffect(() => {
    // Carrega atributos do tipo lista para o dropdown
    getListAttributes().then(attrs => {
      setListAttributes(attrs);
      if (attrs.length && !selectedAttr) setSelectedAttr(attrs[0].attribute_key);
    });
  }, []);

  useEffect(() => {
    if (!selectedAttr) return;
    debugLog('KanbanBoard montado');
    const fetchData = async () => {
      try {
        debugLog('Buscando estágios e contatos...');
        const [kanbanStages, contacts] = await Promise.all([
          getKanbanStages(selectedAttr),
          getContacts()
        ]);
        setStages(kanbanStages);

        debugLog('Estágios:', kanbanStages, 'Contatos:', contacts);

        const organized = kanbanStages.reduce((acc, stage) => {
          acc[stage] = [];
          return acc;
        }, {});

        contacts.forEach(contact => {
          const stage = contact.custom_attributes?.[selectedAttr];
          const col = stage && kanbanStages.includes(stage) ? stage : 'Não Atribuído';
          if (!organized[col]) organized[col] = [];
          organized[col].push(contact);
        });

        setColumns(organized);
        setLoading(false);
      } catch (err) {
        debugLog('Erro ao buscar dados do Kanban:', err);
        setLoading(false);
        setStages([]);
        setColumns({});
        alert('Erro ao carregar dados do Kanban. Veja o console para detalhes.');
      }
    };
    fetchData();
  }, [selectedAttr]);

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
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 p-6 overflow-x-auto bg-gray-50 min-h-screen">
          {stages.map(stage => (
            <KanbanColumn
              key={stage}
              stage={stage}
              contacts={columns[stage] || []}
              attrDisplayNames={attrDisplayNames}
            />
          ))}
        </div>
      </DragDropContext>
    </>
  );
}

export default KanbanBoard;
