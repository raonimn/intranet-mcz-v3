// frontend/src/components/ImportActions.jsx
import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';

import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField, InputAdornment } from '@mui/material';

// Funções auxiliares (a formatDateToDDMMYYYY não é mais enviada para o backend para dataRegistro)
// Mas a manteremos para outras formatações no frontend se necessário.
const formatDateToDDMMYYYY = (date) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};


const ImportActions = forwardRef(({ onProcessingChange, showToast }, ref) => {
    const [showFranchiseModal, setShowFranchiseModal] = useState(false);
    const [showTermosModal, setShowTermosModal] = useState(false);

    const [franchiseFile, setFranchiseFile] = useState(null);
    const franchiseFileInputRef = useRef(null);

    const [termosFile, setTermosFile] = useState(null);
    const termosFileInputRef = useRef(null);
    const [numeroVooInput, setNumeroVooInput] = useState('');

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    useImperativeHandle(ref, () => ({
        showFranchiseModal: () => setShowFranchiseModal(true),
        showTermosModal: () => setShowTermosModal(true),
    }));

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

    const handleCloseTermosModal = () => {
        setShowTermosModal(false);
        setTermosFile(null);
        setNumeroVooInput('');
        if (termosFileInputRef.current) termosFileInputRef.current.value = '';
    };

    const handleTermosFileChange = (e) => setTermosFile(e.target.files[0]);

    const handleNumeroVooInputChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        setNumeroVooInput(value.slice(0, 4));
    };

    const handleTermosUpload = async (e) => {
        e.preventDefault();
        if (!termosFile) {
            showToast('Erro', 'Por favor, selecione um arquivo PDF.', 'danger');
            return;
        }
        if (!numeroVooInput.trim() || numeroVooInput.length !== 4) {
            showToast('Erro', 'Por favor, informe os 4 dígitos do número do Voo.', 'danger');
            return;
        }

        onProcessingChange(true, 'termos');
        handleCloseTermosModal();

        const fullNumeroVoo = `AD${numeroVooInput.toUpperCase()}`;
        
        const formData = new FormData();
        formData.append('pdf_file', termosFile);
        formData.append('numeroVoo', fullNumeroVoo);

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
                                                maxLength: 4,
                                                pattern: "[0-9]*"
                                            }
                                        }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Data do Relatório:</Form.Label>
                                    <MuiDatePicker
                                        readOnly
                                        value={new Date()}
                                        format="dd/MM/yyyy"
                                        slotProps={{ textField: { fullWidth: true, size: 'small', sx: { '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } } }}
                                        sx={{
                                            '& .MuiInputBase-input': { color: '#fff' },
                                            '& .MuiInputLabel-root': { color: '#ccc' },
                                            '& .MuiSvgIcon-root': { color: '#ccc' },
                                        }}
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