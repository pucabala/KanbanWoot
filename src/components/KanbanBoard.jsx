// KanbanBoard.jsx
// Componente principal do Kanban dinâmico
import React, { useEffect, useReducer, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { kanbanReducer } from '../reducers/kanbanReducer';
import Notification from './Notification';
import ErrorMessage from './ErrorMessage';
import { useKanbanData } from '../hooks/useKanbanData';
import KanbanColumn from './KanbanColumn';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCustomAttributes } from '../api';

function KanbanBoard() {
  // Hook customizado para buscar contatos, colunas e atributo selecionado
  const { contacts, columns, attribute, loading, error, updateContactAttribute, listAttributes, displayNames } = useKanbanData();
  // Estado local para o board (colunas e cards)
  const [board, dispatch] = useReducer(kanbanReducer, {});
  // Estado para notificações de erro/sucesso
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Carrega e memoiza os display_names dos atributos kbw_ apenas uma vez para todo o board
  const [attrDisplayNames, setAttrDisplayNames] = React.useState({});
  React.useEffect(() => {
    let mounted = true;
    async function fetchDisplayNames() {
      const defs = await getCustomAttributes();
      const map = {};
      defs.forEach(def => {
        if (def.attribute_key && def.attribute_key.startsWith('kbw_')) {
          map[def.attribute_key] = def.attribute_display_name || def.attribute_key;
        }
      });
      if (mounted) setAttrDisplayNames(map);
    }
    fetchDisplayNames();
    return () => { mounted = false; };
  }, []);

  // Organiza os contatos nas colunas sempre que dados mudam
  useEffect(() => {
    if (!loading && contacts.length && columns.length) {
      // Cria objeto com as colunas, incluindo "Não definido" para valores nulos
      const organized = columns.reduce((acc, col) => {
        acc[col] = [];
        return acc;
      }, { "Não definido": [] });
      // Distribui contatos nas colunas conforme valor do atributo customizado
      contacts.forEach(contact => {
        const value = contact.custom_attributes?.[attribute.attribute_key] ?? "Não definido";
        if (!organized[value]) organized[value] = [];
        organized[value].push(contact);
      });
      // Atualiza o estado do board
      dispatch({ type: 'INIT', payload: organized });
    }
  }, [contacts, columns, attribute, loading]);

  /**
   * Handler do drag-and-drop: move o card e atualiza o valor do atributo no backend
   */
  const onDragEnd = async ({ source, destination }) => {
    if (!destination) return;
    const sourceList = Array.from(board[source.droppableId]);
    const [moved] = sourceList.splice(source.index, 1);
    const destList = Array.from(board[destination.droppableId] || []);
    destList.splice(destination.index, 0, moved);
    const prevBoard = JSON.parse(JSON.stringify(board));
    dispatch({
      type: 'MOVE_CARD',
      payload: {
        source: source.droppableId,
        destination: destination.droppableId,
        contact: moved
      }
    });
    try {
      // Atualiza o valor do atributo customizado do contato
      let newValue;
      if (destination.droppableId === "Não definido") {
        // Para "Não definido", apaga a chave do atributo (remove do JSON)
        newValue = undefined;
      } else {
        newValue = destination.droppableId;
      }
      await updateContactAttribute(moved.id, attribute.attribute_key, newValue);
    } catch (err) {
      setNotification({ type: 'error', message: `Erro ao atualizar estágio: ${err?.message || err}` });
      dispatch({ type: 'INIT', payload: prevBoard });
      console.error('[KanbanBoard] Falha ao atualizar estágio:', err);
    }
  };

  // Muda a URL ao trocar o atributo
  const handleAttributeChange = (e) => {
    const newKey = e.target.value;
    const params = new URLSearchParams(location.search);
    params.set('kbw', newKey);
    navigate({ search: params.toString() });
  };

  // Exibe loading, erro ou o board
  if (loading) return <div className="p-4">Carregando Kanban...</div>;
  if (error) return <ErrorMessage message={`Erro ao carregar dados: ${error.message}`} />;
  if (!attribute) return <ErrorMessage message="Nenhum atributo customizado do tipo lista encontrado." />;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Notificação de erro/sucesso */}
      {notification && <Notification type={notification.type} message={notification.message} />}
      {/* Dropdown para seleção de atributo */}
      <div className="mb-4">
        <label htmlFor="attribute-select" className="block text-sm font-medium text-gray-700 mb-1">
          Selecione o atributo:
        </label>
        <select
          id="attribute-select"
          value={attribute?.attribute_key}
          onChange={handleAttributeChange}
          className="border border-gray-300 rounded p-2"
        >
          {listAttributes.map(attr => (
            <option key={attr.attribute_key} value={attr.attribute_key}>
              {attr.attribute_display_name || attr.attribute_key}
            </option>
          ))}
        </select>
      </div>
  
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 overflow-x-auto">
          {/* Renderiza cada coluna do Kanban, incluindo "Não definido" na frente */}
          {["Não definido", ...columns].map(col => (
            <KanbanColumn
              key={col}
              stage={col}
              contacts={board[col] || []}
              attrDisplayNames={displayNames}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

export default KanbanBoard;
