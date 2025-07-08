// frontend/src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Importando nossas novas páginas
import HomePage from "./pages/HomePage";
import DadosCombinadosPage from "./pages/DadosCombinadosPage";

import "./App.css";

function App() {
  return (
    <Router>
      {/* O NotificationToast agora é renderizado pelo ToastProvider em main.jsx */}
      <Routes>
        {/* Rota para a página inicial */}
        <Route path="/" element={<HomePage />} />
        
        {/* Rota para a página principal de controle e análise de dados */}
        <Route path="/controle" element={<DadosCombinadosPage />} />
        
        {/* Redirecionamento (opcional): se o usuário acessar uma rota antiga */}
        <Route path="/dados-combinados" element={<DadosCombinadosPage />} />
      </Routes>
    </Router>
  );
}

export default App;