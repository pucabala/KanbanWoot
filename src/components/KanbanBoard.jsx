// KanbanBoard.jsx
// Componente principal do Kanban dinâmico
import React, { useEffect, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import Notification from './Notification';
import ErrorMessage from './ErrorMessage';
import { useKanbanData } from '../hooks/useKanbanData';
import KanbanColumn from './KanbanColumn';
import { useNavigate, useLocation } from 'react-router-dom';
import { CHATWOOT_LOGIN_URL, UNASSIGNED_STAGE, stageOutcome } from '../api';
import { useChatwootContext } from '../hooks/useChatwootContext';
import OutcomeDialog from './OutcomeDialog';

function KanbanBoard() {
  // Colunas carregadas página a página, filtradas no servidor
  const { agent, board, columns, attribute, loading, error, listAttributes, displayNames, loadMore, moveContact, filters, setFilters, labels } = useKanbanData();
  // Estado para notificações de erro/sucesso
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Busca com atraso para não refazer as buscas a cada tecla
  const [searchText, setSearchText] = useState(filters.search);
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(f => (f.search === searchText.trim() ? f : { ...f, search: searchText.trim() }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchText, setFilters]);
  const hasFilters = Boolean(filters.search || filters.label || searchText);

  // Move de fato (otimista, desfeito se a API falhar)
  const performMove = async move => {
    try {
      await moveContact(move);
    } catch (err) {
      setNotification({ type: 'error', message: `Erro ao atualizar estágio: ${err?.message || err}` });
      console.error('[KanbanBoard] Falha ao atualizar estágio:', err);
    }
  };

  // Etapas finais (ganho/perda) pedem o motivo antes de mover
  const [pendingMove, setPendingMove] = useState(null);
  const requestMove = move => {
    const outcome = move.source !== move.destination ? stageOutcome(move.destination) : null;
    if (outcome) setPendingMove({ ...move, outcome });
    else performMove(move);
  };

  // Menu "Mover para…": vai para o topo da coluna de destino
  const moveFromMenu = (contact, sourceIndex, source, destination) =>
    requestMove({ contactId: contact.id, contactName: contact.name, source, destination, sourceIndex, destinationIndex: 0 });

  /**
   * Handler do drag-and-drop: move o card e atualiza o valor do atributo no backend
   */
  const onDragEnd = ({ source, destination, draggableId }) => {
    if (!destination) return;
    const contact = board[source.droppableId]?.contacts[source.index];
    if (!contact || String(contact.id) !== draggableId) return;
    requestMove({
      contactId: contact.id,
      contactName: contact.name,
      source: source.droppableId,
      destination: destination.droppableId,
      sourceIndex: source.index,
      destinationIndex: destination.index
    });
  };

  // Contato da conversa aberta no Chatwoot (Painel de Aplicativos)
  const { contact: openContact } = useChatwootContext();
  const openContactStage = openContact && attribute
    ? (openContact.custom_attributes?.[attribute.attribute_key] ?? UNASSIGNED_STAGE)
    : null;
  const openContactLoaded = Boolean(openContact && Object.values(board).some(col => col.contacts.some(c => c.id === openContact.id)));

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

      {/* Contato da conversa aberta no Chatwoot */}
      {openContact && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2 rounded text-sm" role="status">
          Conversa aberta: <strong>{openContact.name}</strong> — etapa{' '}
          <strong>{openContactStage === UNASSIGNED_STAGE ? UNASSIGNED_STAGE : (displayNames[openContactStage] || openContactStage)}</strong>
          {!openContactLoaded && <span className="text-blue-700"> (card não carregado ou fora dos filtros)</span>}
        </div>
      )}

      {/* Busca e filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input
          type="search"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail"
          aria-label="Buscar contatos"
          className="border border-gray-300 rounded p-2 w-72 max-w-full"
        />
        {labels.length > 0 && (
          <select
            value={filters.label}
            onChange={e => setFilters(f => ({ ...f, label: e.target.value }))}
            aria-label="Filtrar por etiqueta"
            className="border border-gray-300 rounded p-2"
          >
            <option value="">Todas as etiquetas</option>
            {labels.map(label => <option key={label} value={label}>{label}</option>)}
          </select>
        )}
        {hasFilters && (
          <button
            type="button"
            className="text-sm text-blue-600 hover:underline"
            onClick={() => { setSearchText(''); setFilters({ search: '', label: '' }); }}
          >
            Limpar filtros
          </button>
        )}
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
              onMoveCard={(contact, index, destination) => moveFromMenu(contact, index, col, destination)}
              stages={columns}
              attributeKey={attribute.attribute_key}
              highlightId={openContact?.id}
              attrDisplayNames={displayNames}
            />
          ))}
        </div>
      </DragDropContext>

      {pendingMove && (
        <OutcomeDialog
          outcome={pendingMove.outcome}
          contactName={pendingMove.contactName}
          stageLabel={displayNames[pendingMove.destination] || pendingMove.destination}
          onCancel={() => setPendingMove(null)}
          onConfirm={reason => {
            const { outcome, contactName, ...move } = pendingMove;
            setPendingMove(null);
            performMove({ ...move, reason });
          }}
        />
      )}
    </div>
  );
}

export default KanbanBoard;
