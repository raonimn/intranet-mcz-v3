// frontend/src/components/ImportStatusTermosModal.jsx
import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { Modal, Form } from 'react-bootstrap';
import logActivity from "../../utils/logService";
import useToast from '../../hooks/useToast'; // <-- IMPORTAR


import {
    Button,
    Box,
    Typography,
    CircularProgress
} from '@mui/material';

const ImportStatusTermosModal = ({ show, handleClose, onImportSuccess }) => {
    const { showToast } = useToast(); // <-- USAR O HOOK
    const [pastedData, setPastedData] = useState('');

    const [loading, setLoading] = useState(false);

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    const handlePasteChange = useCallback((e) => {
        setPastedData(e.target.value);
    }, []);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!pastedData.trim()) {
            showToast('Erro', 'Por favor, cole os dados na caixa de texto.', 'danger');
            return;
        }

        setLoading(true);
        logActivity('Início da Importação de Status de Termos', {}, true);

        try {
            const response = await axios.post(`${BACKEND_URL}/api/upload-status-termos`, { pasted_data: pastedData });

            // LINHAS ANTIGAS (REMOVER):
            // showToast('Sucesso', response.data.message, 'success');

            // LINHA MODIFICADA: Passe os dados de resposta para a função pai
            onImportSuccess(response.data);

            logActivity('Importação de Status de Termos Finalizada', response.data, true);
            handleClose();
        } catch (error) {
            showToast('Erro', error.response?.data?.message || 'Erro ao importar status de termos.', 'danger');
            console.error('[ImportStatusTermosModal] Erro no upload de status de termos:', error);
            logActivity('Falha na Importação de Status de Termos', { error: error.message, response: error.response?.data }, false);
        } finally {
            setLoading(false);
            setPastedData('');
        }
    }, [pastedData, showToast, onImportSuccess, handleClose, BACKEND_URL]);

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header className="px-4" closeButton>
                <Modal.Title className="ms-auto">Importar Status de Termos</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>Cole os dados da tabela (Ctrl+V):</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={10}
                            value={pastedData}
                            onChange={handlePasteChange}
                            placeholder={`Exemplo:\nNº do TADe\tData\tSituação\tValor\tTA\tDAR\tEmail\tLiberar\n1122802\t01/07/2025\tPendente (Enviar e-mail)\tR$ 30,76\t\t\t`}
                            required
                        />
                    </Form.Group>
                    <Button
                        variant="contained"
                        color="primary"
                        type="submit"
                        fullWidth
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                        {loading ? 'Processando...' : 'Processar Dados'}
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

export default ImportStatusTermosModal;