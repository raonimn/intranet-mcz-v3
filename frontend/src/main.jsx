// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ToastProvider } from './context/ToastContext.jsx'; // <-- 1. IMPORTAR

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {/* 2. ENVOLVER O APP COM O PROVIDER */}
      <ToastProvider>
        <App />
      </ToastProvider>
    </LocalizationProvider>
  </React.StrictMode>,
);