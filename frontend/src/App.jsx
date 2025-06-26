// frontend/src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './components/Home';
import ImportTermo from './components/ImportTermo';
import ImportReport from './components/ImportReport';
import CombinedData from './components/CombinedData';

// Importe o CSS global que você criou
import './App.css';

function App() {
    return (
        <Router>
            <nav className="navbar">
                <Link to="/">Home</Link>
                <Link to="/importar-termos">Importar Termos</Link>
                <Link to="/importar-report">Importar Franchise Report</Link>
                <Link to="/dados-combinados">Ver Dados Combinados</Link>
            </nav>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/importar-termos" element={<ImportTermo />} />
                <Route path="/importar-report" element={<ImportReport />} />
                <Route path="/dados-combinados" element={<CombinedData />} />
                {/* Futuramente, se precisar da rota /natura, adicione aqui */}
                {/* <Route path="/natura" element={<Natura />} /> */}
            </Routes>
        </Router>
    );
}

export default App;