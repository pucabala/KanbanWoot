// CustomAttributesList.jsx
import React from 'react';

/**
 * @param {{ attributes: Record<string, any>, displayNames: Record<string, string> }} props
 */
export default function CustomAttributesList({ attributes, displayNames }) {
  return (
    <div className="mt-2 text-xs text-gray-500">
      {Object.entries(attributes)
        .filter(([key, value]) => key.startsWith('kbw_') && value != null && value !== '')
        .map(([key, value]) => (
          <div key={key} className="truncate" title={String(value)}>
            <span className="font-semibold">{displayNames[key] || key.replace('kbw_', '')}: </span>
            <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
    </div>
  );
}
