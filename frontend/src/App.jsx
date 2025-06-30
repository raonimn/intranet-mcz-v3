// frontend/src/App.jsx
import React, { useState, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/NavBar';
import CombinedData from './components/CombinedData';
// REMOVIDO: import ExtractedTermDataModal from './components/ExtractedTermDataModal';

// MUI Imports (mantidos)
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Fab from '@mui/material/Fab';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Dropdown from 'react-bootstrap/Dropdown';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// Icons (mantidos)
import MenuIcon from '@mui/icons-material/Menu';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FlightIcon from '@mui/icons-material/Flight';


import './App.css';

const formatDateToDDMMYYYY = (date) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState({});

    const [filterAwb, setFilterAwb] = useState('');
    const [filterTermo, setFilterTermo] = useState('');
    const [filterDestino, setFilterDestino] = useState('');
    const [filterVoo, setFilterVoo] = useState('');
    const [filterDataTermo, setFilterDataTermo] = useState(null);

    const combinedDataRef = useRef(null);

    // REMOVIDO: showExtractedDataModal e extractedTermData
    // const [showExtractedDataModal, setShowExtractedDataModal] = useState(false);
    // const [extractedTermData, setExtractedTermData] = useState([]);


    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

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
        setIsSidebarOpen(false);
    }, [filterAwb, filterTermo, filterDestino, filterVoo, filterDataTermo]);


    const handleImportAction = useCallback((type) => { // REMOVIDO: `data` do parâmetro
        if (combinedDataRef.current) {
            if (type === 'franchise') {
                combinedDataRef.current.showFranchiseModal();
            } else if (type === 'termos') {
                combinedDataRef.current.showTermosModal();
            }
            // REMOVIDO: Lógica para acionar o modal de termos extraídos
            // else if (type === 'extractedTerms' && data) {
            //     setExtractedTermData(data);
            //     setShowExtractedDataModal(true);
            // }
        }
        setIsSidebarOpen(false);
    }, []);

    // REMOVIDO: handleCloseExtractedDataModal
    // const handleCloseExtractedDataModal = () => {
    //     setShowExtractedDataModal(false);
    //     setExtractedTermData([]);
    // };


    return (
        <Router>
            <Navbar />

            <Tooltip title={isSidebarOpen ? "Fechar Menu" : "Abrir Menu de Filtros"} placement="right">
                <Fab
                    color="primary"
                    aria-label="open drawer"
                    onClick={toggleSidebar}
                    sx={{
                        position: 'fixed',
                        top: '50%',
                        left: isSidebarOpen ? '260px' : '20px',
                        transform: 'translateY(-50%)',
                        zIndex: 1200,
                        transition: 'left 0.3s ease-in-out',
                        display: { xs: 'none', md: 'flex' }
                    }}
                >
                    {isSidebarOpen ? <CloseIcon /> : <MenuIcon />}
                </Fab>
            </Tooltip>

            <Drawer
                anchor="left"
                open={isSidebarOpen}
                onClose={toggleSidebar}
                PaperProps={{
                    sx: {
                        width: 280,
                        boxSizing: 'border-box',
                        backgroundColor: '#343a40',
                        color: '#fff',
                        paddingTop: '64px',
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
                        <ListItem disablePadding>
                            <Dropdown className="w-100">
                                <Dropdown.Toggle variant="secondary" id="dropdown-tools-mui" className="w-100 text-start">
                                    <ListItemIcon sx={{ minWidth: 36, color: '#dee2e6' }}><SearchIcon /></ListItemIcon>
                                    <ListItemText primary="Ferramentas" />
                                </Dropdown.Toggle>

                                <Dropdown.Menu dark>
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

                        <ListItem>
                            <ListItemText primary={<Box sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Filtros de Pesquisa</Box>} />
                        </ListItem>

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
                                    '& .MuiSvgIcon-root': { color: '#ccc' },
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
                                    // REMOVIDO: onTermosImported
                                    ref={combinedDataRef}
                                />}
                    />
                    <Route
                        path="/dados-combinados"
                        element={<CombinedData
                                    filters={activeFilters}
                                    isSidebarOpen={isSidebarOpen}
                                    // REMOVIDO: onTermosImported
                                    ref={combinedDataRef}
                                />}
                    />
                </Routes>
            </div>

            {/* REMOVIDO: Modal para exibir dados de termos importados */}
            {/* <ExtractedTermDataModal
                show={showExtractedDataModal}
                handleClose={handleCloseExtractedDataModal}
                data={extractedTermData}
            /> */}

        </Router>
    );
}

export default App;