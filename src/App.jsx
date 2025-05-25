//App.jsx
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import KanbanBoard from './components/KanbanBoard';

export default function App() {
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
