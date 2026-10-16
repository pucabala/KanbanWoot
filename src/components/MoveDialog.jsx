// MoveDialog.jsx
// Formulário exibido antes de mover um card quando a etapa de destino pede informação:
// motivo (ganho/perda), valor do negócio (ganho) e campos obrigatórios da etapa
import React, { useEffect, useRef, useState } from 'react';
import { LOST_REASONS, parseValue } from '../api';

const NUMBER_TYPES = ['number', 'currency', 'percent'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Converte o texto do campo para o valor gravado no Chatwoot; { error } se for inválido
function convertField(field, raw) {
  const text = typeof raw === 'string' ? raw.trim() : raw;
  if (text === '' || text === undefined || text === null) return { error: `Preencha "${field.label}".` };
  if (NUMBER_TYPES.includes(field.type)) {
    const value = parseValue(text);
    return value === null ? { error: `"${field.label}" deve ser um número.` } : { value };
  }
  if (field.type === 'checkbox') return { value: text === 'true' };
  if (field.type === 'email' && !EMAIL_RE.test(text)) return { error: `"${field.label}" não parece um e-mail válido.` };
  if (field.type === 'link' && !/^https?:\/\/\S+$/i.test(text)) return { error: `"${field.label}" deve começar com http:// ou https://.` };
  return { value: text };
}

function FieldInput({ field, value, onChange, inputRef }) {
  const common = {
    ref: inputRef,
    value,
    onChange: e => onChange(e.target.value),
    'aria-label': field.label,
    className: 'w-full border border-gray-300 rounded p-2'
  };
  if (field.type === 'list') {
    return (
      <select {...common}>
        <option value="">Escolha…</option>
        {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <select {...common}>
        <option value="">Escolha…</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    );
  }
  const type = { date: 'date', email: 'email', tel: 'tel', link: 'url' }[field.type] || 'text';
  return <input {...common} type={type} inputMode={NUMBER_TYPES.includes(field.type) ? 'decimal' : undefined} />;
}

/**
 * @param {{
 *  outcome: 'won' | 'lost' | null,
 *  contactName: string,
 *  stageLabel: string,
 *  askValue?: boolean,
 *  fields?: Array<{ key: string, label: string, type: string, options?: string[] }>,
 *  onConfirm: (result: { reason: string, dealValue?: number, fieldValues: Record<string, any> }) => void,
 *  onCancel: () => void
 * }} props
 */
export default function MoveDialog({ outcome, contactName, stageLabel, askValue = false, fields = [], onConfirm, onCancel }) {
  const [preset, setPreset] = useState('');
  const [text, setText] = useState('');
  const [valueText, setValueText] = useState('');
  const [fieldTexts, setFieldTexts] = useState({});
  const [error, setError] = useState('');
  const firstFieldRef = useRef(null);
  const isLost = outcome === 'lost';
  const isWon = outcome === 'won';
  const showReasonSelect = isLost && LOST_REASONS.length > 0;
  // Texto livre: sempre no ganho; na perda, quando não há motivos sugeridos ou foi escolhido "Outro…"
  const showReasonText = Boolean(outcome) && (!isLost || !LOST_REASONS.length || preset === '__other__');
  const showValue = isWon && askValue;

  // Foco inicial uma vez só; Esc cancela
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = e => { if (e.key === 'Escape') onCancelRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = e => {
    e.preventDefault();
    const fieldValues = {};
    for (const field of fields) {
      const { value, error: fieldError } = convertField(field, fieldTexts[field.key] ?? '');
      if (fieldError) {
        setError(fieldError);
        return;
      }
      fieldValues[field.key] = value;
    }
    const reason = (showReasonSelect && preset !== '__other__' ? preset : text).trim();
    if (isLost && !reason) {
      setError('Informe o motivo da perda.');
      return;
    }
    const dealValue = showValue && valueText.trim() ? parseValue(valueText) : undefined;
    if (dealValue === null || (typeof dealValue === 'number' && dealValue < 0)) {
      setError('Valor inválido. Use, por exemplo, 1500 ou 1.500,00.');
      return;
    }
    onConfirm({ reason, dealValue, fieldValues });
  };

  // O primeiro campo visível recebe o foco
  const focusTarget = fields.length ? 'field' : showReasonSelect ? 'select' : showValue ? 'value' : 'text';
  const title = isLost ? 'Motivo da perda' : isWon ? 'Negócio ganho' : 'Preencha para mover';
  const confirmClass = isLost ? 'bg-red-600' : isWon ? 'bg-green-600' : 'bg-blue-600';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-dialog-title"
        className="bg-white rounded-lg shadow-xl p-5 w-full max-w-md max-h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        noValidate
      >
        <h2 id="move-dialog-title" className="text-lg font-semibold mb-1">{title}</h2>
        <p className="text-sm text-gray-600 mb-4">
          {contactName} → <strong>{stageLabel}</strong>
        </p>

        {fields.length > 0 && (
          <fieldset className="mb-3">
            <legend className="text-sm font-medium text-gray-700 mb-2">Obrigatório nesta etapa</legend>
            {fields.map((field, i) => (
              <label key={field.key} className="block mb-2 text-sm text-gray-700">
                {field.label}
                <FieldInput
                  field={field}
                  value={fieldTexts[field.key] ?? ''}
                  onChange={v => { setFieldTexts(f => ({ ...f, [field.key]: v })); setError(''); }}
                  inputRef={i === 0 && focusTarget === 'field' ? firstFieldRef : undefined}
                />
              </label>
            ))}
          </fieldset>
        )}

        {showReasonSelect && (
          <select
            ref={focusTarget === 'select' ? firstFieldRef : undefined}
            value={preset}
            onChange={e => { setPreset(e.target.value); setError(''); }}
            aria-label="Motivo"
            className="w-full border border-gray-300 rounded p-2 mb-3"
          >
            <option value="">Escolha um motivo…</option>
            {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            <option value="__other__">Outro…</option>
          </select>
        )}
        {showValue && (
          <input
            ref={focusTarget === 'value' ? firstFieldRef : undefined}
            type="text"
            inputMode="decimal"
            value={valueText}
            onChange={e => { setValueText(e.target.value); setError(''); }}
            aria-label="Valor do negócio (opcional)"
            placeholder="Valor do negócio (opcional), ex.: 1.500,00"
            className="w-full border border-gray-300 rounded p-2 mb-3"
          />
        )}
        {showReasonText && (
          <textarea
            ref={focusTarget === 'text' ? firstFieldRef : undefined}
            value={text}
            onChange={e => { setText(e.target.value); setError(''); }}
            aria-label={isLost ? 'Motivo da perda' : 'Observação (opcional)'}
            placeholder={isLost ? 'Por que o negócio foi perdido?' : 'Observação (opcional)'}
            rows={3}
            maxLength={500}
            className="w-full border border-gray-300 rounded p-2 mb-3"
          />
        )}
        {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded border border-gray-300">Cancelar</button>
          <button type="submit" className={`px-3 py-1.5 rounded text-white ${confirmClass}`}>Confirmar</button>
        </div>
      </form>
    </div>
  );
}
