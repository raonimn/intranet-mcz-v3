// frontend/src/components/ImportActions.jsx
import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import axios from "axios";
import { Modal, Button as BSButton, Form, Row, Col } from "react-bootstrap"; // Button como BSButton para não conflitar

import { TextField, InputAdornment, Button, Box } from "@mui/material"; // Button do MUI

import ImportStatusTermosModal from "./ImportStatusTermosModal";

import useToast from '../../hooks/useToast'; // <-- IMPORTAR


const ImportActions = forwardRef(({ onProcessingChange }, ref) => {
  const { showToast } = useToast(); // <-- USAR O HOOK
  const [showFranchiseModal, setShowFranchiseModal] = useState(false);
  const [showTermosModal, setShowTermosModal] = useState(false);
  const [showStatusTermosModal, setShowStatusTermosModal] = useState(false);


  const [franchiseFile, setFranchiseFile] = useState(null);
  const franchiseFileInputRef = useRef(null);

  const [termosFile, setTermosFile] = useState(null);
  const termosFileInputRef = useRef(null);
  const [numeroVooInput, setNumeroVooInput] = useState("");

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useImperativeHandle(ref, () => ({
    showFranchiseModal: () => setShowFranchiseModal(true),
    showTermosModal: () => setShowTermosModal(true),
    showStatusTermosModal: () => setShowStatusTermosModal(true),
  }));

  const handleCloseFranchiseModal = useCallback(() => {
    setShowFranchiseModal(false);
    setFranchiseFile(null);
    if (franchiseFileInputRef.current) franchiseFileInputRef.current.value = "";
  }, []);

  const handleFranchiseFileChange = useCallback((e) => setFranchiseFile(e.target.files[0]), []);

  const handleFranchiseUpload = useCallback(async (e) => {
    e.preventDefault();
    if (!franchiseFile) {
      showToast("Erro", "Por favor, selecione um arquivo XLSX.", "danger");
      return;
    }

    onProcessingChange(true, "franchise");
    handleCloseFranchiseModal();

    const formData = new FormData();
    formData.append("xlsx_file", franchiseFile);

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/upload-report`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      showToast(
        "Sucesso",
        `${response.data.message} ${response.data.additionalInfo}`,
        "success"
      );
    } catch (error) {
      showToast(
        "Erro",
        error.response?.data?.message ||
        "Erro ao processar o arquivo Franchise Report.",
        "danger"
      );
      console.error("[ImportActions] Erro no upload Franchise:", error);
    } finally {
      onProcessingChange(false, "franchise");
    }
  }, [franchiseFile, onProcessingChange, handleCloseFranchiseModal, showToast, BACKEND_URL]);

  const handleCloseTermosModal = useCallback(() => {
    setShowTermosModal(false);
    setTermosFile(null);
    setNumeroVooInput("");
    if (termosFileInputRef.current) termosFileInputRef.current.value = "";
  }, []);

  const handleTermosFileChange = useCallback((e) => setTermosFile(e.target.files[0]), []);

  const handleNumeroVooInputChange = useCallback((e) => {
    const value = e.target.value.replace(/\D/g, "");
    setNumeroVooInput(value.slice(0, 4));
  }, []);

  const handleTermosUpload = useCallback(async (e) => {
    e.preventDefault();
    if (!termosFile) {
      showToast("Erro", "Por favor, selecione um arquivo PDF.", "danger");
      return;
    }
    if (!numeroVooInput.trim() || numeroVooInput.length !== 4) {
      showToast(
        "Erro",
        "Por favor, informe os 4 dígitos do número do Voo.",
        "danger"
      );
      return;
    }

    onProcessingChange(true, "termos");
    handleCloseTermosModal();

    const fullNumeroVoo = `AD${numeroVooInput.toUpperCase()}`;

    const formData = new FormData();
    formData.append("pdf_file", termosFile);
    formData.append("numeroVoo", fullNumeroVoo);

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/upload-pdf`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      showToast(
        "Sucesso",
        `${response.data.message} ${response.data.additionalInfo}`,
        "success"
      );
      onProcessingChange(false, "termos", response.data.extractedData);
    } catch (error) {
      showToast(
        "Erro",
        error.response?.data?.message ||
        "Erro ao processar o arquivo de Termos.",
        "danger"
      );
      console.error("[ImportActions] Erro no upload Termos:", error);
      onProcessingChange(false, "termos");
    }
  }, [termosFile, numeroVooInput, onProcessingChange, handleCloseTermosModal, showToast, BACKEND_URL]);

  const handleCloseStatusTermosModal = useCallback(() => setShowStatusTermosModal(false), []);

  const handleStatusTermosImportSuccess = useCallback(() => {
    showToast("Sucesso", "Status de termos atualizados com sucesso!", "success");
    onProcessingChange(false, "statusTermos");
  }, [showToast, onProcessingChange]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
      {/* Modal Franchise Report */}
      <Modal show={showFranchiseModal} onHide={handleCloseFranchiseModal} centered>
        <Modal.Header className="px-4" closeButton>
          <Modal.Title className="ms-auto">
            Importar Franchise Report (SK)
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleFranchiseUpload}>
            <Form.Group controlId="formFileFranchise" className="mb-3">
              <Form.Label className="d-block text-center fw-bold">
                Selecione o arquivo XLSX:
              </Form.Label>
              <Form.Control
                type="file"
                accept=".xlsx"
                onChange={handleFranchiseFileChange}
                ref={franchiseFileInputRef}
                required
              />
            </Form.Group>
            <Button variant="contained" color="primary" type="submit" fullWidth>
              Upload
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal Termos (SEFAZ-AL) */}
      <Modal show={showTermosModal} onHide={handleCloseTermosModal} centered>
        <Modal.Header className="px-4" closeButton>
          <Modal.Title className="ms-auto">
            Importar Termos (SEFAZ-AL)
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleTermosUpload}>
            <Row className="mb-3 justify-content-center">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="d-block text-center fw-bold">
                    Número do Voo:
                  </Form.Label>
                  <TextField
                    fullWidth
                    size="small"
                    value={numeroVooInput}
                    onChange={handleNumeroVooInputChange}
                    placeholder="Ex: 1234"
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">AD</InputAdornment>
                      ),
                      inputProps: {
                        maxLength: 4,
                        pattern: "[0-9]*",
                      },
                    }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group controlId="formFileTermos" className="mb-3">
              <Form.Label className="d-block text-center fw-bold">
                Selecione o arquivo PDF:
              </Form.Label>
              <Form.Control
                type="file"
                accept=".pdf"
                onChange={handleTermosFileChange}
                ref={termosFileInputRef}
                required
              />
            </Form.Group>

            <Button variant="contained" color="primary" type="submit" fullWidth>
              Upload
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal ImportStatusTermosModal */}
      <ImportStatusTermosModal
        show={showStatusTermosModal}
        handleClose={handleCloseStatusTermosModal}
        showToast={showToast}
        onImportSuccess={handleStatusTermosImportSuccess}
      />
    </Box>
  );
});

export default ImportActions;