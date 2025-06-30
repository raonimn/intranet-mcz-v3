// frontend/src/components/ExtractedTermDataModal.jsx
import React from 'react';
import { Modal, Button, Table } from 'react-bootstrap';
import * as XLSX from 'xlsx'; // Importar xlsx para exportar

const ExtractedTermDataModal = ({ show, handleClose, data }) => {

    const exportToExcel = () => {
        if (!data || data.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }

        const ws = XLSX.utils.aoa_to_sheet([
            ["Data de Emissão", "Chave MDF-e", "Nº Termo Averiguação", "Chave da NF-e", "Nº do CT-e", "Nº da NFe"],
            ...data // Os dados já estão no formato de array de arrays
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Termos Importados");
        XLSX.writeFile(wb, "termos_importados.xlsx");
    };

    return (
        <Modal show={show} onHide={handleClose} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>Dados dos Termos Importados</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {data && data.length > 0 ? (
                    <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <Table striped bordered hover size="sm">
                            <thead>
                                <tr>
                                    <th>Dt Emissão</th>
                                    <th>Chave MDF-e</th>
                                    <th>Nº Termo</th>
                                    <th>Chave NF-e</th>
                                    <th>Nº CT-e</th>
                                    <th>Nº NFe</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row, index) => (
                                    <tr key={index}>
                                        <td>{row[0] || 'N/A'}</td>
                                        <td>{row[1] || 'N/A'}</td>
                                        <td>{row[2] || 'N/A'}</td>
                                        <td>{row[3] || 'N/A'}</td>
                                        <td>{row[4] || 'N/A'}</td>
                                        <td>{row[5] || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                ) : (
                    <p className="text-center">Nenhum dado importado para exibir.</p>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Fechar
                </Button>
                <Button variant="success" onClick={exportToExcel} disabled={!data || data.length === 0}>
                    Exportar para Excel
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ExtractedTermDataModal;