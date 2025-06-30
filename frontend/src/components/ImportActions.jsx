// frontend/src/components/ImportActions.jsx
import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
// Removido: import DatePicker from 'react-datepicker';
// Removido: import 'react-datepicker/dist/react-datepicker.css';

// Usar DatePicker do MUI (se a importação for via este modal)
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material'; // Usar TextField do MUI para o input de texto do voo

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
    const [numeroVoo, setNumeroVoo] = useState('');
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

        onProcessingChange(true, 'franchise'); // Indica que um processamento de franchise iniciou
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
            onProcessingChange(false, 'franchise'); // Indica que um processamento de franchise finalizou
        }
    };

    // --- Termos SEFAZ-AL Modal Handlers ---
    const handleCloseTermosModal = () => {
        setShowTermosModal(false);
        setTermosFile(null);
        setNumeroVoo('');
        setDataRegistro(new Date());
        if (termosFileInputRef.current) termosFileInputRef.current.value = '';
    };

    const handleTermosFileChange = (e) => setTermosFile(e.target.files[0]);
    const handleNumeroVooChange = (e) => setNumeroVoo(e.target.value);
    const handleDataRegistroChange = (date) => setDataRegistro(date);

    const handleTermosUpload = async (e) => {
        e.preventDefault();
        if (!termosFile) {
            showToast('Erro', 'Por favor, selecione um arquivo PDF.', 'danger');
            return;
        }
        if (!numeroVoo.trim()) {
            showToast('Erro', 'Por favor, informe o número do Voo.', 'danger');
            return;
        }
        if (!dataRegistro) {
            showToast('Erro', 'Por favor, informe a Data do Relatório.', 'danger');
            return;
        }

        onProcessingChange(true, 'termos'); // Indica que um processamento de termos iniciou
        handleCloseTermosModal();

        const formData = new FormData();
        formData.append('pdf_file', termosFile);
        formData.append('numeroVoo', numeroVoo);
        formData.append('dataRegistro', formatDateToDDMMYYYY(dataRegistro));

        try {
            const response = await axios.post(`${BACKEND_URL}/api/upload-pdf`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            showToast('Sucesso', `${response.data.message} ${response.data.additionalInfo}`, 'success');
            // Passar os dados extraídos para o componente pai para exibir no modal (Funcionalidade 8)
            onProcessingChange(false, 'termos', response.data.extractedData); // Passa os dados extraídos
        } catch (error) {
            showToast('Erro', error.response?.data?.message || 'Erro ao processar o arquivo de Termos.', 'danger');
            console.error('Erro no upload Termos:', error);
            onProcessingChange(false, 'termos'); // Indica que um processamento de termos finalizou (sem dados)
        }
    };


    return (
        <div className="d-flex justify-content-center mb-4">
            {/* Estes botões serão removidos e suas ações acionadas pelo Sidebar */}
            {/*
            <Button variant="success" className="me-3" onClick={() => setShowFranchiseModal(true)}>
                Importar Franchise Report (SK)
            </Button>
            <Button variant="success" onClick={() => setShowTermosModal(true)}>
                Importar Termos (SEFAZ-AL)
            </Button>
            */}

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
                                    {/* Usando TextField do MUI */}
                                    <TextField
                                        fullWidth
                                        size="small"
                                        value={numeroVoo}
                                        onChange={handleNumeroVooChange}
                                        placeholder="Ex: AD1234"
                                        required
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