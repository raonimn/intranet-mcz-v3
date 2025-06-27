// frontend/src/components/ImportActions.jsx

import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap'; // <-- Adicionado Row e Col aqui
import DatePicker from 'react-datepicker'; // Para o seletor de data
import 'react-datepicker/dist/react-datepicker.css'; // Estilos do seletor de data

// Funções auxiliares (copiadas de CombinedData.jsx ou de um arquivo de utils comum)
const formatDateToDDMMYYYY = (date) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const ImportActions = ({ onProcessingChange, showToast }) => {
    const [showFranchiseModal, setShowFranchiseModal] = useState(false);
    const [showTermosModal, setShowTermosModal] = useState(false);

    const [franchiseFile, setFranchiseFile] = useState(null);
    const franchiseFileInputRef = useRef(null); // Ref para resetar o input file

    const [termosFile, setTermosFile] = useState(null);
    const termosFileInputRef = useRef(null); // Ref para resetar o input file
    const [numeroVoo, setNumeroVoo] = useState('');
    const [dataRegistro, setDataRegistro] = useState(new Date()); // Usará objeto Date para DatePicker

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    // --- Frachise Report Modal Handlers ---
    const handleShowFranchiseModal = () => setShowFranchiseModal(true);
    const handleCloseFranchiseModal = () => {
        setShowFranchiseModal(false);
        setFranchiseFile(null);
        if (franchiseFileInputRef.current) franchiseFileInputRef.current.value = ''; // Reseta input file
    };

    const handleFranchiseFileChange = (e) => setFranchiseFile(e.target.files[0]);

    const handleFranchiseUpload = async (e) => {
        e.preventDefault();
        if (!franchiseFile) {
            showToast('Erro', 'Por favor, selecione um arquivo XLSX.', 'danger');
            return;
        }

        onProcessingChange(true); // Ativa o overlay de carregamento
        handleCloseFranchiseModal(); // Fecha o modal

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
            onProcessingChange(false); // Desativa o overlay
        }
    };

    // --- Termos SEFAZ-AL Modal Handlers ---
    const handleShowTermosModal = () => setShowTermosModal(true);
    const handleCloseTermosModal = () => {
        setShowTermosModal(false);
        setTermosFile(null);
        setNumeroVoo('');
        setDataRegistro(new Date()); // Reseta para a data atual
        if (termosFileInputRef.current) termosFileInputRef.current.value = ''; // Reseta input file
    };

    const handleTermosFileChange = (e) => setTermosFile(e.target.files[0]);
    const handleNumeroVooChange = (e) => setNumeroVoo(e.target.value);

    // DatePicker já trabalha com objetos Date, mas a API espera string
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
        if (!dataRegistro) { // DataRegistro já é um objeto Date
            showToast('Erro', 'Por favor, informe a Data do Relatório.', 'danger');
            return;
        }

        onProcessingChange(true); // Ativa o overlay de carregamento
        handleCloseTermosModal(); // Fecha o modal

        const formData = new FormData();
        formData.append('pdf_file', termosFile);
        formData.append('numeroVoo', numeroVoo);
        formData.append('dataRegistro', formatDateToDDMMYYYY(dataRegistro)); // Converte para string dd/mm/yyyy

        try {
            const response = await axios.post(`${BACKEND_URL}/api/upload-pdf`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            showToast('Sucesso', `${response.data.message} ${response.data.additionalInfo}`, 'success');
        } catch (error) {
            showToast('Erro', error.response?.data?.message || 'Erro ao processar o arquivo de Termos.', 'danger');
            console.error('Erro no upload Termos:', error);
        } finally {
            onProcessingChange(false); // Desativa o overlay
        }
    };


    return (
        <div className="d-flex justify-content-center mb-4">
            <Button variant="success" className="me-3" onClick={handleShowFranchiseModal}>
                Importar Franchise Report (SK)
            </Button>
            <Button variant="success" onClick={handleShowTermosModal}>
                Importar Termos (SEFAZ-AL)
            </Button>

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
                        <Row className="mb-3"> {/* Nova Row para alinhar lado a lado */}
                            <Col md={6}> {/* Coluna para Número do Voo */}
                                <Form.Group>
                                    <Form.Label>Número do Voo:</Form.Label>
                                    <Form.Control type="text" value={numeroVoo} onChange={handleNumeroVooChange} placeholder="Ex: AD1234" required />
                                </Form.Group>
                            </Col>
                            <Col md={6}> {/* Coluna para Data do Relatório */}
                                <Form.Group>
                                    <Form.Label>Data do Relatório:</Form.Label>
                                    <DatePicker
                                        selected={dataRegistro}
                                        onChange={handleDataRegistroChange}
                                        dateFormat="dd/MM/yyyy"
                                        className="form-control" // Aplica estilo do Bootstrap
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Form.Group controlId="formFileTermos" className="mb-3"> {/* Campo de seleção de PDF */}
                            <Form.Label>Selecione o arquivo PDF:</Form.Label>
                            <Form.Control type="file" accept=".pdf" onChange={handleTermosFileChange} ref={termosFileInputRef} required />
                        </Form.Group>

                        <Button variant="primary" type="submit" className="w-100"> {/* Botão de Upload */}
                            Upload
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default ImportActions;