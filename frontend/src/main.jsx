// frontend/src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';
// Importa o Bootstrap JS (inclui Popper.js para tooltips e popovers)
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
// Importa o Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);