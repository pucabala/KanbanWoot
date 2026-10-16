// KanbanBoard.jsx
// Componente principal do Kanban dinâmico
import React, { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import Notification from './Notification';
import ErrorMessage from './ErrorMessage';
import { useKanbanData } from '../hooks/useKanbanData';
import KanbanColumn from './KanbanColumn';
import { useNavigate, useLocation } from 'react-router-dom';
import { CHATWOOT_LOGIN_URL } from '../api';

function KanbanBoard() {
  // Colunas carregadas página a página, filtradas no servidor
  const { agent, board, columns, attribute, loading, error, listAttributes, displayNames, loadMore, moveContact } = useKanbanData();
  // Estado para notificações de erro/sucesso
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Handler do drag-and-drop: move o card e atualiza o valor do atributo no backend
   */
  const onDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination) return;
    const contact = board[source.droppableId]?.contacts[source.index];
    if (!contact || String(contact.id) !== draggableId) return;
    try {
      await moveContact({
        contactId: contact.id,
        source: source.droppableId,
        destination: destination.droppableId,
        sourceIndex: source.index,
        destinationIndex: destination.index
      });
    } catch (err) {
      setNotification({ type: 'error', message: `Erro ao atualizar estágio: ${err?.message || err}` });
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
  if (error?.code === 'NOT_LOGGED_IN') {
    return (
      <div role="alert" className="m-6 bg-yellow-50 border border-yellow-300 text-yellow-900 px-4 py-3 rounded">
        <p className="font-semibold">Você não está logado no Chatwoot.</p>
        <p className="mt-1">
          <a href={CHATWOOT_LOGIN_URL} target="_top" className="underline">Entre no Chatwoot</a> e depois recarregue esta página.
        </p>
      </div>
    );
  }
  if (error) return <ErrorMessage message={`Erro ao carregar dados: ${error.message}`} />;
  if (!attribute) return <ErrorMessage message="Nenhum atributo customizado do tipo lista encontrado." />;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Notificação de erro/sucesso */}
      {notification && <Notification type={notification.type} message={notification.message} />}
      {/* Dropdown para seleção de atributo */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
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
        {agent && <span className="text-sm text-gray-500">Conectado como {agent.name || agent.email}</span>}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 overflow-x-auto">
          {/* Renderiza cada coluna do Kanban, com "Não definido" na frente */}
          {columns.map(col => (
            <KanbanColumn
              key={col}
              stage={col}
              column={board[col]}
              onLoadMore={() => loadMore(col)}
              attrDisplayNames={displayNames}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

export default KanbanBoard;
