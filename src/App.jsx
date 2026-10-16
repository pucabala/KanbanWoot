//App.jsx
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import KanbanBoard from './components/KanbanBoard';

// Permite servir o app em um subcaminho (ex.: /kanban/ no domínio do Chatwoot)
const basename = window.location.pathname.replace(/\/[^/]*$/, '');

export default function App() {
  return (
    <Router basename={basename}>
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
