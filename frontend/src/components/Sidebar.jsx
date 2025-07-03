// frontend/src/components/Sidebar.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Dropdown, Form, Button as BSButton } from 'react-bootstrap';
// import DatePicker from 'react-datepicker'; // <-- REMOVER ESTE IMPORT
// import 'react-datepicker/dist/react-datepicker.css'; // <-- REMOVER ESTE IMPORT

// --- IMPORTS DO MUI ---
import {
    TextField,
    Button,
    Box,
    Typography,
} from '@mui/material';
// --- NOVO IMPORT PARA O DESKTOP DATE PICKER DO MUI X ---
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';
// Importar dayjs para trabalhar com as datas do MUI X DatePicker
import dayjs from 'dayjs';


const formatDateToDDMMYYYY = (date) => {
    // Agora o date será um objeto Dayjs, então precisamos formatá-lo
    if (!date) return '';
    return dayjs(date).format('DD/MM/YYYY');
};

function Sidebar({ isOpen, toggleSidebar, onFilterChange, onImportClick }) {
    const [filterAwb, setFilterAwb] = useState('');
    const [filterTermo, setFilterTermo] = useState('');
    const [filterDestino, setFilterDestino] = useState('');
    const [filterVoo, setFilterVoo] = useState('');
    // Inicializar com dayjs(null) ou null, dependendo do comportamento desejado
    const [filterDataTermo, setFilterDataTermo] = useState(null);

    useEffect(() => {
        if (!isOpen) {
            // Lógica de reset comentada
        }
    }, [isOpen]);

    const handleFilterSubmit = useCallback((e) => {
        e.preventDefault();
        const filters = {
            awb: filterAwb.trim(),
            termo: filterTermo.trim(),
            destino: filterDestino.trim(),
            voo: filterVoo.trim(),
            // Formatar a data ao enviar
            dataTermo: filterDataTermo ? formatDateToDDMMYYYY(filterDataTermo) : '',
        };
        onFilterChange(filters);
    }, [filterAwb, filterTermo, filterDestino, filterVoo, filterDataTermo, onFilterChange]);

    return (
        <Box className={`sidebar ${isOpen ? 'active' : ''}`} sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
            <BSButton variant="link" className="sidebar-toggle-button d-lg-none" onClick={toggleSidebar}>
                &times;
            </BSButton>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Menu Principal
            </Typography>
            <ul className="list-unstyled components">
                <li>
                    <Dropdown>
                        <Dropdown.Toggle as={BSButton} variant="secondary" id="dropdown-tools" className="w-100">
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
                <li className="sidebar-separator"></li>
                <li>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Pesquisa:
                    </Typography>
                    <Form onSubmit={handleFilterSubmit}>
                        <Form.Group className="mb-2">
                            <Form.Label>AWB:</Form.Label>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Digite o AWB"
                                value={filterAwb}
                                onChange={(e) => setFilterAwb(e.target.value.slice(0, 8))}
                                inputProps={{ maxLength: 8 }}
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Termo:</Form.Label>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Digite o Termo"
                                value={filterTermo}
                                onChange={(e) => setFilterTermo(e.target.value.slice(0, 8))}
                                inputProps={{ maxLength: 8 }}
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Destino:</Form.Label>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Digite o Destino"
                                value={filterDestino}
                                onChange={(e) => setFilterDestino(e.target.value.slice(0, 6))}
                                inputProps={{ maxLength: 6 }}
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Voo:</Form.Label>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Digite o Voo"
                                value={filterVoo}
                                onChange={(e) => setFilterVoo(e.target.value.slice(0, 6))}
                                inputProps={{ maxLength: 6 }}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Data do termo:</Form.Label>
                            {/* --- SUBSTITUIR react-datepicker POR DesktopDatePicker do MUI X --- */}
                            <DesktopDatePicker
                                label="Selecione a data"
                                inputFormat="DD/MM/YYYY" // O formato de exibição
                                value={filterDataTermo}
                                onChange={(newValue) => {
                                    setFilterDataTermo(newValue);
                                }}
                                renderInput={(params) => (
                                    <TextField {...params} fullWidth size="small" />
                                )}
                            />
                        </Form.Group>
                        <Button variant="contained" color="primary" type="submit" fullWidth>
                            Aplicar Filtros
                        </Button>
                    </Form>
                </li>
            </ul>
        </Box>
    );
}

export default Sidebar;