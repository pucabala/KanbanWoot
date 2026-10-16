// KanbanColumn.jsx
import React, { useEffect, useRef } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';
import { UNASSIGNED_STAGE } from '../api';

/**
 * @param {{
 *  stage: string,
 *  column?: { contacts: Array<object>, count: number | null, hasMore: boolean, loading: boolean, error: Error | null },
 *  onLoadMore: () => void,
 *  attrDisplayNames?: Record<string, string>
 * }} props
 */
export default function KanbanColumn({ stage, column, onLoadMore, attrDisplayNames }) {
  const contacts = column?.contacts || [];
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const canLoadMore = Boolean(column?.hasMore && !column?.loading && !column?.error);

  // Carrega a próxima página quando o fim da coluna fica visível
  useEffect(() => {
    if (!canLoadMore || !sentinelRef.current) return undefined;
    const observer = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) onLoadMore(); },
      { root: scrollRef.current, rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [canLoadMore, onLoadMore, contacts.length]);

  return (
    <div className="bg-white rounded shadow-md min-w-[20rem] w-80 flex flex-col max-h-[calc(100vh-10rem)]">
      <h2 className="px-4 py-2 font-semibold border-b border-gray-200 flex justify-between gap-2" id={`col-title-${stage}`}>
        {stage === UNASSIGNED_STAGE
          ? <span className="italic text-gray-500">{UNASSIGNED_STAGE}</span>
          : <span>{attrDisplayNames?.[stage] || stage}</span>}
        {typeof column?.count === 'number' && (
          <span className="text-sm font-normal text-gray-500" aria-label="Total de contatos">{column.count}</span>
        )}
      </h2>
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={el => { provided.innerRef(el); scrollRef.current = el; }}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 p-4 flex-grow min-h-[100px] overflow-y-auto ${
              snapshot.isDraggingOver ? 'bg-blue-50' : ''
            }`}
            role="list"
            aria-labelledby={`col-title-${stage}`}
          >
            {contacts.map((contact, index) => (
              <KanbanCard key={contact.id} contact={contact} index={index} attrDisplayNames={attrDisplayNames} />
            ))}
            {provided.placeholder}
            {column?.loading && <div className="text-sm text-gray-500 text-center py-2">Carregando...</div>}
            {column?.error && (
              <div className="text-sm text-red-600 text-center py-2">
                Erro ao carregar.{' '}
                <button type="button" className="underline" onClick={onLoadMore}>Tentar de novo</button>
              </div>
            )}
            {canLoadMore && (
              <button
                ref={sentinelRef}
                type="button"
                className="text-sm text-blue-600 hover:underline py-2"
                onClick={onLoadMore}
              >
                Carregar mais
              </button>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
