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
export default function KanbanColumn({ stage, contacts, attrDisplayNames }) {
  // Recebe attrDisplayNames do KanbanBoard via props (agora centralizado)
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
          </div>
        )}
      </Droppable>
    </div>
  );
}
