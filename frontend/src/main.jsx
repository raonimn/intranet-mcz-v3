// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap/dist/css/bootstrap.min.css';

// Importações para MUI DatePicker
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale'; // Para localização em português

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {/* Envolver App com LocalizationProvider para o DatePicker do MUI */}
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
            <App />
        </LocalizationProvider>
    </React.StrictMode>,
);