// frontend/src/hooks/useToast.js
import { useContext } from 'react';
import ToastContext from '../context/ToastContext';

const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast deve ser usado dentro de um ToastProvider');
    }
    return context;
};

export default useToast;