// ChatwootConfigForm.jsx
import React, { useEffect, useState } from 'react';
import { setCookie, getCookie } from '../api';

/**
 * Formulário de configuração do Chatwoot (visual e estado isolados)
 */
export default function ChatwootConfigForm({ onConfigured }) {
  const [url, setUrl] = useState('');
  const [accountId, setAccountId] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState(0); // 0: url, 1: account, 2: token, 3: resumo
  const [error, setError] = useState('');

  function handleNext(e) {
    e.preventDefault();
    setError('');
    if (step === 0 && !url) return setError('Informe a URL do Chatwoot.');
    if (step === 1 && !accountId) return setError('Informe o Account ID.');
    if (step === 2 && !token) return setError('Informe o Token.');
    setStep(step + 1);
  }

  function handleBack(e) {
    e.preventDefault();
    setError('');
    setStep(step - 1);
  }

  function handleSave(e) {
    e.preventDefault();
    setCookie('url', url);
    setCookie('account_id', accountId);
    setCookie('token', token);
    if (onConfigured) onConfigured();
    window.location.reload();
  }

  useEffect(() => {
    // Usa getConnectionParam do api.js para garantir prioridade e validação
    import('../api').then(({ getConnectionParam }) => {
      setUrl(getConnectionParam('url', 'REACT_APP_CHATWOOT_URL'));
      setAccountId(getConnectionParam('account_id', 'REACT_APP_CHATWOOT_ACCOUNT_ID'));
      setToken(getConnectionParam('token', 'REACT_APP_CHATWOOT_TOKEN'));
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-indigo-700 text-center">Configurar Chatwoot</h2>
        <form onSubmit={step === 3 ? handleSave : handleNext}>
          {step === 0 && (
            <div>
              <label className="block mb-2 font-medium text-gray-700">Chatwoot URL</label>
              <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://meuchatwoot.com" required autoFocus className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 mb-4" />
            </div>
          )}
          {step === 1 && (
            <div>
              <label className="block mb-2 font-medium text-gray-700">Account ID</label>
              <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="Ex: 1" required autoFocus className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 mb-4" />
            </div>
          )}
          {step === 2 && (
            <div>
              <label className="block mb-2 font-medium text-gray-700">Token</label>
              <input type="text" value={token} onChange={e => setToken(e.target.value)} placeholder="Seu token de API" required autoFocus className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 mb-4" />
            </div>
          )}
          {step === 3 && (
            <div className="mb-4">
              <div className="mb-2 text-gray-700">Confirme os dados antes de salvar:</div>
              <div className="bg-gray-50 rounded p-3 text-sm">
                <div><span className="font-semibold">URL:</span> {url}</div>
                <div><span className="font-semibold">Account ID:</span> {accountId}</div>
                <div><span className="font-semibold">Token:</span> <span className="text-gray-400">{token.slice(0, 4)}...{token.slice(-4)}</span></div>
              </div>
            </div>
          )}
          {error && <div className="text-red-600 mb-3 text-sm">{error}</div>}
          <div className="flex justify-between mt-6">
            {step > 0 && <button onClick={handleBack} className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300">Voltar</button>}
            <button type="submit" className="ml-auto px-6 py-2 rounded bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition-all">
              {step === 3 ? 'Salvar e Entrar' : 'Avançar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
