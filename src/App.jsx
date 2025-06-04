//App.jsx
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import KanbanBoard from './components/KanbanBoard';
import ChatwootConfigForm from './components/ChatwootConfigForm';

export default function App() {
  // Checa se está configurado
  const isConfigured = Boolean(
    (document.cookie.includes('url') && document.cookie.includes('account_id') && document.cookie.includes('token'))
  );

  if (!isConfigured) {
    return <ChatwootConfigForm />;
  }

  return (
    <Router>
      <div className="app-container">
        <main>
          <Routes>
            <Route path="/" element={<KanbanBoard />} />
            {/* Futuras rotas podem ser adicionadas aqui */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}
