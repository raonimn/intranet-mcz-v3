// frontend/src/components/Home.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
    return (
        <div className="container">
            <div className="header">
                <h1>Importação de Relatórios</h1>
            </div>
            <div className="button-container">
                <Link to="/importar-report" className="import-button">
                    Importar Franchise Report (SK)
                </Link>
                <Link to="/importar-termos" className="import-button">
                    Importar Termos (PDF recebido pela SEFAZ-AL)
                </Link>
                <Link to="/dados-combinados" className="import-button">
                    Ver Dados Combinados
                </Link>
                {/* Adicione um link para a página Natura se for necessário, adaptando-o */}
                {/* <Link to="/natura" className="import-button">
                    Sistema Natura
                </Link> */}
            </div>
        </div>
    );
}

export default Home;