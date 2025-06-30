// frontend/src/components/ImportActions.jsx
import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';

// Usar DatePicker do MUI e TextField com InputAdornment do MUI
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField, InputAdornment } from '@mui/material'; // <-- Adicionado InputAdornment

// Funções auxiliares (manter ou mover para utils.js)
const formatDateToDDMMYYYY = (date) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// Envolver o componente com forwardRef
const ImportActions = forwardRef(({ onProcessingChange, showToast }, ref) => {
    const [showFranchiseModal, setShowFranchiseModal] = useState(false);
    const [showTermosModal, setShowTermosModal] = useState(false);

    const [franchiseFile, setFranchiseFile] = useState(null);
    const franchiseFileInputRef = useRef(null);

    const [termosFile, setTermosFile] = useState(null);
    const termosFileInputRef = useRef(null);
    const [numeroVooInput, setNumeroVooInput] = useState(''); // Estado para o input de 4 dígitos
    const [dataRegistro, setDataRegistro] = useState(new Date());

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    // Expor métodos para o componente pai via useImperativeHandle
    useImperativeHandle(ref, () => ({
        showFranchiseModal: () => setShowFranchiseModal(true),
        showTermosModal: () => setShowTermosModal(true),
    }));

    // --- Frachise Report Modal Handlers ---
    const handleCloseFranchiseModal = () => {
        setShowFranchiseModal(false);
        setFranchiseFile(null);
        if (franchiseFileInputRef.current) franchiseFileInputRef.current.value = '';
    };

    const handleFranchiseFileChange = (e) => setFranchiseFile(e.target.files[0]);

    const handleFranchiseUpload = async (e) => {
        e.preventDefault();
        if (!franchiseFile) {
            showToast('Erro', 'Por favor, selecione um arquivo XLSX.', 'danger');
            return;
        }

        onProcessingChange(true, 'franchise');
        handleCloseFranchiseModal();

        const formData = new FormData();
        formData.append('xlsx_file', franchiseFile);

        try {
            const response = await axios.post(`${BACKEND_URL}/api/upload-report`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            showToast('Sucesso', `${response.data.message} ${response.data.additionalInfo}`, 'success');
        } catch (error) {
            showToast('Erro', error.response?.data?.message || 'Erro ao processar o arquivo Franchise Report.', 'danger');
            console.error('Erro no upload Franchise:', error);
        } finally {
            onProcessingChange(false, 'franchise');
        }
    };

    // --- Termos SEFAZ-AL Modal Handlers ---
    const handleCloseTermosModal = () => {
        setShowTermosModal(false);
        setTermosFile(null);
        setNumeroVooInput(''); // Limpa o input de 4 dígitos
        setDataRegistro(new Date());
        if (termosFileInputRef.current) termosFileInputRef.current.value = '';
    };

    const handleTermosFileChange = (e) => setTermosFile(e.target.files[0]);

    // Lógica para o campo de Voo: limita a 4 dígitos e garante que seja numérico
    const handleNumeroVooInputChange = (e) => {
        const value = e.target.value.replace(/\D/g, ''); // Remove não-dígitos
        setNumeroVooInput(value.slice(0, 4)); // Limita a 4 dígitos
    };

    const handleDataRegistroChange = (date) => setDataRegistro(date);

    const handleTermosUpload = async (e) => {
        e.preventDefault();
        if (!termosFile) {
            showToast('Erro', 'Por favor, selecione um arquivo PDF.', 'danger');
            return;
        }
        if (!numeroVooInput.trim() || numeroVooInput.length !== 4) { // Valida que tem 4 dígitos
            showToast('Erro', 'Por favor, informe os 4 dígitos do número do Voo.', 'danger');
            return;
        }
        if (!dataRegistro) {
            showToast('Erro', 'Por favor, informe a Data do Relatório.', 'danger');
            return;
        }

        onProcessingChange(true, 'termos');
        handleCloseTermosModal();

        const fullNumeroVoo = `AD${numeroVooInput.toUpperCase()}`; // Adiciona "AD" e garante maiúscula
        
        const formData = new FormData();
        formData.append('pdf_file', termosFile);
        formData.append('numeroVoo', fullNumeroVoo); // Envia o número completo
        formData.append('dataRegistro', formatDateToDDMMYYYY(dataRegistro));

        try {
            const response = await axios.post(`${BACKEND_URL}/api/upload-pdf`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            showToast('Sucesso', `${response.data.message} ${response.data.additionalInfo}`, 'success');
            onProcessingChange(false, 'termos', response.data.extractedData);
        } catch (error) {
            showToast('Erro', error.response?.data?.message || 'Erro ao processar o arquivo de Termos.', 'danger');
            console.error('Erro no upload Termos:', error);
            onProcessingChange(false, 'termos');
        }
    };


    return (
        <div className="d-flex justify-content-center mb-4">
            {/* Modal para Importar Franchise Report */}
            <Modal show={showFranchiseModal} onHide={handleCloseFranchiseModal} centered>
                <Modal.Header className="px-4" closeButton>
                    <Modal.Title className="ms-auto">Importar Franchise Report (SK)</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleFranchiseUpload}>
                        <Form.Group controlId="formFileFranchise" className="mb-3">
                            <Form.Label>Selecione o arquivo XLSX:</Form.Label>
                            <Form.Control type="file" accept=".xlsx" onChange={handleFranchiseFileChange} ref={franchiseFileInputRef} required />
                        </Form.Group>
                        <Button variant="primary" type="submit" className="w-100">
                            Upload
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Modal para Importar Termos SEFAZ-AL */}
            <Modal show={showTermosModal} onHide={handleCloseTermosModal} centered>
                <Modal.Header className="px-4" closeButton>
                    <Modal.Title className="ms-auto">Importar Termos (SEFAZ-AL)</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleTermosUpload}>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Número do Voo:</Form.Label>
                                    {/* Campo de Voo com InputAdornment e limitação */}
                                    <TextField
                                        fullWidth
                                        size="small"
                                        value={numeroVooInput}
                                        onChange={handleNumeroVooInputChange}
                                        placeholder="Ex: 1234"
                                        required
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start">AD</InputAdornment>,
                                            inputProps: {
                                                maxLength: 4, // Limita o input a 4 caracteres
                                                pattern: "[0-9]*" // Sugere teclado numérico em alguns navegadores
                                            }
                                        }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Data do Relatório:</Form.Label>
                                    {/* Usando DatePicker do MUI */}
                                    <MuiDatePicker
                                        value={dataRegistro}
                                        onChange={handleDataRegistroChange}
                                        format="dd/MM/yyyy"
                                        slotProps={{ textField: { fullWidth: true, size: 'small', required: true } }}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Form.Group controlId="formFileTermos" className="mb-3">
                            <Form.Label>Selecione o arquivo PDF:</Form.Label>
                            <Form.Control type="file" accept=".pdf" onChange={handleTermosFileChange} ref={termosFileInputRef} required />
                        </Form.Group>

                        <Button variant="primary" type="submit" className="w-100">
                            Upload
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </div>
    );
});

export default ImportActions;