// KanbanColumn.jsx
import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';

/**
 * @param {{
 *  stage: string,
 *  contacts: Array<{ id: number | string, name: string, email?: string }>
 * }} props
 */
export default function KanbanColumn({ stage, contacts, attrDisplayNames, onLoadMore, hasMore }) {
  const loaderRef = React.useRef(null);

  React.useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const observer = new window.IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { root: null, rootMargin: '0px', threshold: 0.1 }
    );
    const currentLoader = loaderRef.current;
    if (currentLoader) observer.observe(currentLoader);
    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [hasMore, onLoadMore]);

  return (
    <div className="bg-white rounded shadow-md min-w-[20rem] flex flex-col">
      <h2 className="px-4 py-2 font-semibold border-b border-gray-200" id={`col-title-${stage}`}>
        {stage === "Não definido"
          ? <span className="italic text-gray-500">Não definido</span>
          : (attrDisplayNames?.[stage] || stage)}
      </h2>
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 p-4 flex-grow min-h-[100px] ${
              snapshot.isDraggingOver ? 'bg-blue-50' : ''
            }`}
            role="list"
            aria-labelledby={`col-title-${stage}`}
          >
            {contacts.map((contact, index) => (
              <KanbanCard key={contact.id} contact={contact} index={index} attrDisplayNames={attrDisplayNames} />
            ))}
            {provided.placeholder}
            {hasMore && <div ref={loaderRef} style={{ minHeight: 40 }} />}
          </div>
        )}
      </Droppable>
    </div>
  );
}
