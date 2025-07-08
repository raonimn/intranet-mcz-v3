// frontend/src/context/ToastContext.jsx
import React, { createContext, useState, useCallback } from 'react';
import NotificationToast from '../components/Common/NotificationToast';

// 1. Criar o Contexto
const ToastContext = createContext(null);

// 2. Criar o Provedor do Contexto
export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState({ show: false, message: '', title: '', type: 'success' });

    const showToast = useCallback((title, message, type = 'success') => {
        setToast({ show: true, title, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast(prev => ({ ...prev, show: false }));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <NotificationToast
                show={toast.show}
                title={toast.title}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
            />
        </ToastContext.Provider>
    );
};

export default ToastContext;