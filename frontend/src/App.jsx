// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/NavBar';
import Home from './components/Home'; // Manter se ainda for usar a página Home
import CombinedData from './components/CombinedData'; // Onde as ações de importação serão exibidas

import './App.css';

function App() {
    return (
        <Router>
            <Navbar />
            <Routes>
                {/* A rota principal pode levar diretamente para CombinedData se Home não for mais usada como landing page */}
                <Route path="/" element={<CombinedData />} /> 
                <Route path="/dados-combinados" element={<CombinedData />} />
                {/* Remover as rotas antigas de importação, pois a funcionalidade será no CombinedData */}
                {/* <Route path="/importar-termos" element={<ImportTermo />} /> */}
                {/* <Route path="/importar-report" element={<ImportReport />} /> */}
            </Routes>
        </Router>
    );
}

export default App;