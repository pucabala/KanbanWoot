// KanbanCard.jsx
import React, { useEffect, useRef } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import CustomAttributesList from './CustomAttributesList';
import { getChatwootContactUrl, stageSinceKey, stageReasonKey, stageOutcome, STALE_DAYS, UNASSIGNED_STAGE } from '../api';

const DAY_MS = 24 * 60 * 60 * 1000;

// Dias desde que o contato entrou na etapa atual (null se a data não for conhecida)
function daysInStage(contact, attributeKey) {
  const since = Date.parse(contact.custom_attributes?.[stageSinceKey(attributeKey)]);
  if (Number.isNaN(since)) return null;
  return Math.max(0, Math.floor((Date.now() - since) / DAY_MS));
}

function StageAge({ days }) {
  if (days === null) return null;
  const color = days >= STALE_DAYS
    ? 'bg-red-100 text-red-700'
    : days >= STALE_DAYS / 2 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-600';
  const label = days === 0 ? 'hoje' : `${days} d`;
  const title = days >= STALE_DAYS
    ? `Parado há ${days} dia(s) nesta etapa (limite: ${STALE_DAYS})`
    : `Nesta etapa há ${days} dia(s)`;
  return <span className={`text-xs px-1.5 py-0.5 rounded ${color}`} title={title}>{label}</span>;
}

// Selo de ganho/perda com o motivo
function OutcomeBadge({ outcome, reason }) {
  if (!outcome) return null;
  const won = outcome === 'won';
  return (
    <div className={`mt-2 text-xs px-2 py-1 rounded ${won ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
      <span className="font-semibold">{won ? '✓ Ganho' : '✗ Perdido'}</span>
      {reason && <span>: {reason}</span>}
    </div>
  );
}

/**
 * @param {{
 *  contact: { id: number | string, name: string, email?: string, custom_attributes?: object },
 *  index: number,
 *  stage: string,
 *  stages: string[],
 *  attributeKey: string,
 *  onMove: (destination: string) => void,
 *  highlighted?: boolean,
 *  attrDisplayNames?: Record<string, string>
 * }} props
 */
export default function KanbanCard({ contact, index, stage, stages = [], attributeKey, onMove, highlighted = false, attrDisplayNames = {} }) {
  // Suporte para thumbnail e telefone
  const thumbnail = contact.thumbnail || contact.avatar_url || contact.profile_picture_url;
  const phone = contact.phone_number || contact.telefone || contact.mobile;
  const contactUrl = getChatwootContactUrl(contact.id);
  const days = stage === UNASSIGNED_STAGE ? null : daysInStage(contact, attributeKey);
  const outcome = stage === UNASSIGNED_STAGE ? null : stageOutcome(stage);
  // Em etapa final o card não "envelhece"
  const isStale = !outcome && days !== null && days >= STALE_DAYS;
  const reason = contact.custom_attributes?.[stageReasonKey(attributeKey)];

  // Rola até o card do contato da conversa aberta no Chatwoot
  const elementRef = useRef(null);
  useEffect(() => {
    if (highlighted) elementRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [highlighted]);

  return (
    <Draggable draggableId={String(contact.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={el => { provided.innerRef(el); elementRef.current = el; }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-gray-100 p-3 rounded shadow cursor-pointer select-none border-l-4 ${
            isStale ? 'border-red-400' : 'border-transparent'
          } ${highlighted ? 'ring-2 ring-blue-500' : ''} ${snapshot.isDragging ? 'bg-blue-200 shadow-lg' : ''}`}
          aria-current={highlighted ? 'true' : undefined}
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
            <div className="font-medium flex-grow min-w-0 truncate">{contact.name}</div>
            {!outcome && <StageAge days={days} />}
            {contactUrl && (
              <a
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-blue-600"
                title="Abrir contato no Chatwoot"
                aria-label={`Abrir ${contact.name} no Chatwoot`}
                onClick={e => e.stopPropagation()}
              >
                ↗
              </a>
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {phone && <span>{phone}</span>}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {contact.email && phone && <span className="mx-2">·</span>}
            {contact.email && <span>{contact.email}</span>}
          </div>
          <OutcomeBadge outcome={outcome} reason={reason} />
          {/* Mostra atributos customizados usando componente separado */}
          {contact.custom_attributes && (
            <CustomAttributesList attributes={contact.custom_attributes} displayNames={attrDisplayNames} />
          )}
          {/* Alternativa ao arrastar (teclado, celular) */}
          {onMove && stages.length > 1 && (
            <select
              className="mt-2 w-full text-xs border border-gray-300 rounded p-1 bg-white text-gray-600"
              aria-label={`Mover ${contact.name} para`}
              value=""
              onChange={e => { if (e.target.value) onMove(e.target.value); }}
            >
              <option value="">Mover para…</option>
              {stages.filter(s => s !== stage).map(s => (
                <option key={s} value={s}>{attrDisplayNames[s] || s}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </Draggable>
  );
}
