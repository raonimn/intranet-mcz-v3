// frontend/src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { Dropdown, Form, Button } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'; // Estilos do datepicker


const formatDateToDDMMYYYY = (date) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

function Sidebar({ isOpen, toggleSidebar, onFilterChange, onImportClick }) {
    const [filterAwb, setFilterAwb] = useState('');
    const [filterTermo, setFilterTermo] = useState('');
    const [filterDestino, setFilterDestino] = useState('');
    const [filterVoo, setFilterVoo] = useState('');
    const [filterDataTermo, setFilterDataTermo] = useState(null); // Usar null para o DatePicker

    // Efeito para redefinir os filtros quando o sidebar é fechado
    // ou se necessário para limpar o estado de filtros
    useEffect(() => {
        if (!isOpen) {
            // Se você quiser resetar os filtros ao fechar o sidebar
            // setFilterAwb('');
            // setFilterTermo('');
            // setFilterDestino('');
            // setFilterVoo('');
            // setFilterDataTermo(null);
        }
    }, [isOpen]);

    const handleFilterSubmit = (e) => {
        e.preventDefault();
        // Construir o objeto de filtros a ser passado para o componente pai
        const filters = {
            awb: filterAwb.trim(),
            termo: filterTermo.trim(),
            destino: filterDestino.trim(),
            voo: filterVoo.trim(),
            dataTermo: filterDataTermo ? formatDateToDDMMYYYY(filterDataTermo) : '',
        };
        onFilterChange(filters);
    };

    return (
        <div className={`sidebar ${isOpen ? 'active' : ''}`}>
            <Button variant="link" className="sidebar-toggle-button d-lg-none" onClick={toggleSidebar}>
                &times; {/* Ícone de fechar para dispositivos menores */}
            </Button>
            <div className="sidebar-header">
                <h3>Menu Principal</h3>
            </div>
            <ul className="list-unstyled components">
                <li>
                    <Dropdown>
                        <Dropdown.Toggle variant="secondary" id="dropdown-tools">
                            Ferramentas
                        </Dropdown.Toggle>

                        <Dropdown.Menu>
                            <Dropdown.Item onClick={() => onImportClick('franchise')}>
                                Importar dados SK
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => onImportClick('termos')}>
                                Importar termos SEFAZ
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => onImportClick('termos-status')}>
                                Atualizar status dos termos
                            </Dropdown.Item>
                            <Dropdown.Item disabled>
                                Importar malha de voos (Desativado)
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </li>
                <li className="sidebar-separator"></li> {/* Separador visual */}
                <li>
                    <h5>Pesquisa:</h5>
                    <Form onSubmit={handleFilterSubmit}>
                        <Form.Group className="mb-2">
                            <Form.Label>AWB:</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Digite o AWB"
                                value={filterAwb}
                                onChange={(e) => setFilterAwb(e.target.value.slice(0, 8))} // Limita a 8 caracteres
                                maxLength="8"
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Termo:</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Digite o Termo"
                                value={filterTermo}
                                onChange={(e) => setFilterTermo(e.target.value.slice(0, 8))} // Limita a 8 caracteres
                                maxLength="8"
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Destino:</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Digite o Destino"
                                value={filterDestino}
                                onChange={(e) => setFilterDestino(e.target.value.slice(0, 6))} // Limita a 6 caracteres
                                maxLength="6"
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Voo:</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Digite o Voo"
                                value={filterVoo}
                                onChange={(e) => setFilterVoo(e.target.value.slice(0, 6))} // Limita a 6 caracteres
                                maxLength="6"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Data do termo:</Form.Label>
                            <DatePicker
                                selected={filterDataTermo}
                                onChange={(date) => setFilterDataTermo(date)}
                                dateFormat="dd/MM/yyyy"
                                className="form-control"
                                placeholderText="Selecione a data"
                            />
                        </Form.Group>
                        <Button variant="primary" type="submit" className="w-100">
                            Aplicar Filtros
                        </Button>
                    </Form>
                </li>
            </ul>
        </div>
    );
}

export default Sidebar;