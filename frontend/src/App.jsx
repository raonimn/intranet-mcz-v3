// frontend/src/App.jsx
import React, { useState, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/NavBar';
import CombinedData from './components/CombinedData';
import ImportActions from './components/ImportActions'; // Manter aqui, mas será acionado pelo Sidebar
import ExtractedTermDataModal from './components/ExtractedTermDataModal'; // NOVO: para exibir dados do termo importado

// MUI Imports
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Fab from '@mui/material/Fab'; // Floating Action Button
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button'; // Usar Button do MUI para filtros no sidebar
import InputAdornment from '@mui/material/InputAdornment'; // Para ícones dentro do input
import Tooltip from '@mui/material/Tooltip'; // MUI Tooltip
import Dropdown from 'react-bootstrap/Dropdown'; // Manter Dropdown do Bootstrap para o menu Ferramentas se preferir
import { DatePicker } from '@mui/x-date-pickers/DatePicker'; // <-- CORREÇÃO AQUI

// Icons
import MenuIcon from '@mui/icons-material/Menu';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description'; // Ícone para "Termos SEFAZ"
import FileUploadIcon from '@mui/icons-material/FileUpload'; // Ícone para "Dados SK"
import FlightIcon from '@mui/icons-material/Flight'; // Ícone para "Malha de Voos"


import './App.css'; // Onde teremos os estilos gerais e o deslocamento do conteúdo

// Funções auxiliares (pode mover para um arquivo utils.js se quiser)
const applyDateMask = (value) => {
    value = value.replace(/\D/g, "");
    if (value.length > 4) {
        value = value.replace(/^(\d{2})(\d{2})(\d{4}).*/, "$1/$2/$3");
    } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{2}).*/, "$1/$2");
    }
    return value;
};

const formatDateToDDMMYYYY = (date) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState({}); // Filtros a serem passados para CombinedData

    // Estados para os campos de filtro do sidebar
    const [filterAwb, setFilterAwb] = useState('');
    const [filterTermo, setFilterTermo] = useState('');
    const [filterDestino, setFilterDestino] = useState('');
    const [filterVoo, setFilterVoo] = useState('');
    const [filterDataTermo, setFilterDataTermo] = useState(null); // Objeto Date para MUI DatePicker

    // Estado e ref para os modais de importação (Funcionalidade 4 - subitem)
    const importActionsRef = useRef(null);
    const [showExtractedDataModal, setShowExtractedDataModal] = useState(false);
    const [extractedTermData, setExtractedTermData] = useState([]);


    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    // Callback para quando os filtros são aplicados no sidebar
    const handleFilterSubmit = useCallback((e) => {
        e.preventDefault();
        const filters = {
            awb: filterAwb.trim(),
            termo: filterTermo.trim(),
            destino: filterDestino.trim(),
            voo: filterVoo.trim(),
            dataTermo: filterDataTermo ? formatDateToDDMMYYYY(filterDataTermo) : '',
        };
        setActiveFilters(filters);
        setIsSidebarOpen(false); // Fechar o sidebar após aplicar os filtros
    }, [filterAwb, filterTermo, filterDestino, filterVoo, filterDataTermo]);

    // Handler para acionar os modais de importação do ImportActions
    const handleImportAction = useCallback((type, data) => {
        if (importActionsRef.current) {
            if (type === 'franchise') {
                importActionsRef.current.showFranchiseModal();
            } else if (type === 'termos') {
                importActionsRef.current.showTermosModal();
            } else if (type === 'extractedTerms' && data) { // Para exibir os dados extraídos do PDF
                setExtractedTermData(data);
                setShowExtractedDataModal(true);
            }
        }
        setIsSidebarOpen(false); // Fechar o sidebar após acionar uma importação
    }, []);

    // Callback para fechar o modal de dados extraídos
    const handleCloseExtractedDataModal = () => {
        setShowExtractedDataModal(false);
        setExtractedTermData([]);
    };

    // Funções para gerenciar o dropdown "Ferramentas" (pode ser um menu MUI ou Dropdown do react-bootstrap)
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);
    const handleMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleMenuClose = () => {
        setAnchorEl(null);
    };


    return (
        <Router>
            <Navbar /> {/* Navbar não precisa mais do toggleSidebar */}

            {/* Floating Action Button para o Sidebar */}
            <Tooltip title="Abrir Menu de Filtros" placement="right">
                <Fab
                    color="primary"
                    aria-label="open drawer"
                    onClick={toggleSidebar}
                    sx={{
                        position: 'fixed',
                        top: '50%',
                        left: isSidebarOpen ? '260px' : '20px', // Move para a direita quando o sidebar está aberto
                        transform: 'translateY(-50%)',
                        zIndex: 1200, // Acima da maioria dos elementos, abaixo de modais de erro
                        transition: 'left 0.3s ease-in-out',
                        display: { xs: 'none', md: 'flex' } // Visível apenas em telas médias e maiores
                    }}
                >
                    {isSidebarOpen ? <CloseIcon /> : <MenuIcon />}
                </Fab>
            </Tooltip>

            {/* Drawer (Sidebar do MUI) */}
            <Drawer
                anchor="left"
                open={isSidebarOpen}
                onClose={toggleSidebar}
                // PaperProps para ajustar a largura e estilos
                PaperProps={{
                    sx: {
                        width: 280, // Largura do sidebar
                        boxSizing: 'border-box',
                        backgroundColor: '#343a40', // Cor de fundo escura (MUI dark)
                        color: '#fff',
                        paddingTop: '64px', // Espaço para a AppBar fixa
                    },
                }}
            >
                <Box sx={{ p: 2 }}>
                    <IconButton
                        onClick={toggleSidebar}
                        sx={{ position: 'absolute', top: 8, right: 8, color: '#fff' }}
                    >
                        <CloseIcon />
                    </IconButton>
                    <List>
                        {/* Dropdown "Ferramentas" */}
                        <ListItem disablePadding>
                            <Dropdown className="w-100">
                                <Dropdown.Toggle variant="secondary" id="dropdown-tools-mui" className="w-100 text-start">
                                    <ListItemIcon sx={{ minWidth: 36, color: '#dee2e6' }}><SearchIcon /></ListItemIcon>
                                    <ListItemText primary="Ferramentas" />
                                </Dropdown.Toggle>

                                <Dropdown.Menu dark> {/* Use dark para tema escuro */}
                                    <Dropdown.Item onClick={() => handleImportAction('franchise')}>
                                        <ListItemIcon sx={{ minWidth: 36 }}><FileUploadIcon sx={{ color: '#dee2e6' }} /></ListItemIcon>
                                        <ListItemText primary="Importar dados SK" />
                                    </Dropdown.Item>
                                    <Dropdown.Item onClick={() => handleImportAction('termos')}>
                                        <ListItemIcon sx={{ minWidth: 36 }}><DescriptionIcon sx={{ color: '#dee2e6' }} /></ListItemIcon>
                                        <ListItemText primary="Importar termos SEFAZ" />
                                    </Dropdown.Item>
                                    <Dropdown.Item disabled>
                                        <ListItemIcon sx={{ minWidth: 36 }}><FlightIcon sx={{ color: '#dee2e6' }} /></ListItemIcon>
                                        <ListItemText primary="Importar malha de voos" />
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </ListItem>
                        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

                        {/* Título dos Filtros */}
                        <ListItem>
                            <ListItemText primary={<Box sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Filtros de Pesquisa</Box>} />
                        </ListItem>

                        {/* Formulário de Filtros */}
                        <Box component="form" onSubmit={handleFilterSubmit} sx={{ '& .MuiFormControl-root': { mb: 2 } }}>
                            <TextField
                                label="AWB"
                                variant="outlined"
                                fullWidth
                                size="small"
                                value={filterAwb}
                                onChange={(e) => setFilterAwb(e.target.value.slice(0, 8))}
                                inputProps={{ maxLength: 8 }}
                                sx={{ input: { color: '#fff' }, label: { color: '#ccc' }, '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
                            />
                            <TextField
                                label="Termo"
                                variant="outlined"
                                fullWidth
                                size="small"
                                value={filterTermo}
                                onChange={(e) => setFilterTermo(e.target.value.slice(0, 8))}
                                inputProps={{ maxLength: 8 }}
                                sx={{ input: { color: '#fff' }, label: { color: '#ccc' }, '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
                            />
                            <TextField
                                label="Destino"
                                variant="outlined"
                                fullWidth
                                size="small"
                                value={filterDestino}
                                onChange={(e) => setFilterDestino(e.target.value.slice(0, 6))}
                                inputProps={{ maxLength: 6 }}
                                sx={{ input: { color: '#fff' }, label: { color: '#ccc' }, '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
                            />
                            <TextField
                                label="Voo"
                                variant="outlined"
                                fullWidth
                                size="small"
                                value={filterVoo}
                                onChange={(e) => setFilterVoo(e.target.value.slice(0, 6))}
                                inputProps={{ maxLength: 6 }}
                                sx={{ input: { color: '#fff' }, label: { color: '#ccc' }, '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
                            />
                            <DatePicker
                                label="Data do Termo"
                                value={filterDataTermo}
                                onChange={(date) => setFilterDataTermo(date)}
                                format="dd/MM/yyyy"
                                slotProps={{ textField: { fullWidth: true, size: 'small', sx: { '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } } }}
                                sx={{
                                    '& .MuiInputBase-input': { color: '#fff' },
                                    '& .MuiInputLabel-root': { color: '#ccc' },
                                    '& .MuiSvgIcon-root': { color: '#ccc' }, // Ícone do calendário
                                }}
                            />

                            <Button
                                variant="contained"
                                startIcon={<FilterAltIcon />}
                                type="submit"
                                fullWidth
                                sx={{ mt: 2 }}
                            >
                                Aplicar Filtros
                            </Button>
                        </Box>
                    </List>
                </Box>
            </Drawer>

            <div className={`content ${isSidebarOpen ? 'content-shifted' : ''}`}>
                <Routes>
                    <Route
                        path="/"
                        element={<CombinedData
                                    filters={activeFilters}
                                    isSidebarOpen={isSidebarOpen}
                                    onTermosImported={handleImportAction} // Passar a função para acionar o modal de termos
                                />}
                    />
                    <Route
                        path="/dados-combinados"
                        element={<CombinedData
                                    filters={activeFilters}
                                    isSidebarOpen={isSidebarOpen}
                                    onTermosImported={handleImportAction} // Passar a função para acionar o modal de termos
                                />}
                    />
                </Routes>
            </div>

            {/* Modal para exibir dados de termos importados (Funcionalidade 8) */}
            <ExtractedTermDataModal
                show={showExtractedDataModal}
                handleClose={handleCloseExtractedDataModal}
                data={extractedTermData}
            />

            {/* ImportActions com a ref para poder ser acionado */}
            <ImportActions onProcessingChange={(processing) => {
                // Ao finalizar o processamento, se for importação de termos,
                // CombineData vai chamar onTermosImported com os dados,
                // então não precisamos duplicar a chamada aqui.
                // Mas a lógica de toast e overlay continua aqui.
                importActionsRef.current.showAppToast('Processamento', processing ? 'Iniciando importação...' : 'Importação finalizada.', 'info');
            }} showToast={(title, message, type) => {
                // Este showToast é para o ImportActions mostrar seus próprios toasts.
                // Podemos centralizar isso no App.jsx para ter um único ToastContainer.
                // Por agora, vamos manter o ImportActions cuidando de seus próprios toasts,
                // mas essa é uma área para otimização futura.
            }} ref={importActionsRef} />

        </Router>
    );
}

export default App;