// ErrorMessage.jsx
import React from 'react';

/**
 * @param {{ message: string }} props
 */
export default function ErrorMessage({ message }) {
  return (
    <div
      role="alert"
      className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
    >
      <strong className="font-bold">Erro: </strong>
      <span className="block sm:inline">{message}</span>
    </div>
  );
}
// Usage example:
