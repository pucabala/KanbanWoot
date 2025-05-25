// KanbanCard.jsx
import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import CustomAttributesList from './CustomAttributesList';

/**
 * @param {{
 *  contact: { id: number | string, name: string, email?: string },
 *  index: number,
 *  attrDisplayNames?: Record<string, string>
 * }} props
 */
export default function KanbanCard({ contact, index, attrDisplayNames = {} }) {
  // Suporte para thumbnail e telefone
  const thumbnail = contact.thumbnail || contact.avatar_url || contact.profile_picture_url;
  const phone = contact.phone_number || contact.telefone || contact.mobile;

  return (
    <Draggable draggableId={String(contact.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-gray-100 p-3 rounded shadow cursor-pointer select-none ${
            snapshot.isDragging ? 'bg-blue-200 shadow-lg' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            {thumbnail && (
              <img
                src={thumbnail}
                alt={contact.name}
                className="w-6 h-6 rounded-full object-cover"
                style={{ minWidth: 24, minHeight: 24 }}
              />
            )}
            <div className="font-medium">{contact.name}</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {phone && <span>{phone}</span>}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {contact.email && phone && <span className="mx-2">·</span>}
            {contact.email && <span>{contact.email}</span>}
          </div>
          {/* Mostra atributos customizados usando componente separado */}
          {contact.custom_attributes && (
            <CustomAttributesList attributes={contact.custom_attributes} displayNames={attrDisplayNames} />
          )}
        </div>
      )}
    </Draggable>
  );
}
