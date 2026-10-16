// OutcomeDialog.jsx
// Pede o motivo ao mover um contato para uma etapa final (ganho ou perda)
import React, { useEffect, useRef, useState } from 'react';
import { LOST_REASONS, parseValue } from '../api';

/**
 * @param {{
 *  outcome: 'won' | 'lost',
 *  contactName: string,
 *  stageLabel: string,
 *  askValue?: boolean,
 *  onConfirm: (reason: string, dealValue?: number) => void,
 *  onCancel: () => void
 * }} props
 */
export default function OutcomeDialog({ outcome, contactName, stageLabel, askValue = false, onConfirm, onCancel }) {
  const [preset, setPreset] = useState('');
  const [text, setText] = useState('');
  const [valueText, setValueText] = useState('');
  const [error, setError] = useState('');
  const firstFieldRef = useRef(null);
  const isLost = outcome === 'lost';
  // Texto livre: sempre no ganho; na perda, quando não há motivos sugeridos ou foi escolhido "Outro…"
  const useOther = !isLost || !LOST_REASONS.length || preset === '__other__';

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
    const reason = (isLost && !useOther ? preset : text).trim();
    if (isLost && !reason) {
      setError('Informe o motivo da perda.');
      return;
    }
    const showValue = !isLost && askValue;
    const dealValue = showValue && valueText.trim() ? parseValue(valueText) : undefined;
    if (dealValue === null || (typeof dealValue === 'number' && dealValue < 0)) {
      setError('Valor inválido. Use, por exemplo, 1500 ou 1.500,00.');
      return;
    }
    onConfirm(reason, dealValue);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="outcome-title"
        className="bg-white rounded-lg shadow-xl p-5 w-full max-w-md"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id="outcome-title" className="text-lg font-semibold mb-1">
          {isLost ? 'Motivo da perda' : 'Negócio ganho'}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {contactName} → <strong>{stageLabel}</strong>
        </p>

        {isLost && LOST_REASONS.length > 0 && (
          <select
            ref={firstFieldRef}
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
        {!isLost && askValue && (
          <input
            ref={firstFieldRef}
            type="text"
            inputMode="decimal"
            value={valueText}
            onChange={e => { setValueText(e.target.value); setError(''); }}
            aria-label="Valor do negócio (opcional)"
            placeholder="Valor do negócio (opcional), ex.: 1.500,00"
            className="w-full border border-gray-300 rounded p-2 mb-3"
          />
        )}
        {useOther && (
          <textarea
            ref={(isLost && LOST_REASONS.length) || (!isLost && askValue) ? undefined : firstFieldRef}
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
          <button type="submit" className={`px-3 py-1.5 rounded text-white ${isLost ? 'bg-red-600' : 'bg-green-600'}`}>
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}
