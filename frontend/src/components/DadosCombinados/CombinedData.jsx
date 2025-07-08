// frontend/src/components/DadosCombinados/CombinedData.jsx
import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import useToast from '../../hooks/useToast';
import logActivity from '../../utils/logService';

// Novos componentes de apresentação
import SummaryCards from './SummaryCards';
import CombinedDataTable from './CombinedDataTable';

// Componentes de importação
import ImportActions from '../Import/ImportActions';

// Componentes MUI
import { Box, Typography, Paper, TablePagination, TextField, Button, Tabs, Tab } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel } from '@fortawesome/free-solid-svg-icons';

// Funções auxiliares para ordenação
function descendingComparator(a, b, orderBy) {
    if (b[orderBy] < a[orderBy]) return -1;
    if (b[orderBy] > a[orderBy]) return 1;
    return 0;
}
function getComparator(order, orderBy) {
    return order === 'desc' ? (a, b) => descendingComparator(a, b, orderBy) : (a, b) => -descendingComparator(a, b, orderBy);
}
function stableSort(array, comparator) {
    const stabilizedThis = array.map((el, index) => [el, index]);
    stabilizedThis.sort((a, b) => {
        const order = comparator(a[0], b[0]);
        if (order !== 0) return order;
        return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
}

const CombinedData = forwardRef(({ filters, onProcessing }, ref) => {
    const { showToast } = useToast();
    const importActionsRef = useRef(null);
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    // Estados de Dados
    const [fullData, setFullData] = useState([]);
    const [filteredLocalData, setFilteredLocalData] = useState([]);

    // Estados de Loading
    const [cardsLoading, setCardsLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);

    // Estados dos Cards
    const [awbsByDestination, setAwbsByDestination] = useState([]);
    const [missingDates, setMissingDates] = useState({});
    const [lastFranchiseUpdate, setLastFranchiseUpdate] = useState('N/A');

    // Estados de Controle (Filtro local, Abas)
    const [generalFilter, setGeneralFilter] = useState('');
    const [selectedTab, setSelectedTab] = useState(0);

    // Estados de Paginação e Ordenação
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('numero_termo');

    // --- LÓGICA DE BUSCA DE DADOS ---
    const fetchData = useCallback(async () => {
        setTableLoading(true);
        try {
            const queryParams = new URLSearchParams(filters);
            const response = await axios.get(`${BACKEND_URL}/api/combined-data-specific?${queryParams.toString()}`);
            setFullData(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            showToast('Erro', `Erro ao buscar dados: ${err.response?.data?.message || err.message}`, 'danger');
            setFullData([]);
        } finally {
            setTableLoading(false);
        }
    }, [filters, BACKEND_URL, showToast]);

    const fetchDashboardData = useCallback(async () => {
        setCardsLoading(true);
        try {
            const [destRes, datesRes, lastImportRes] = await Promise.all([
                axios.get(`${BACKEND_URL}/api/awbs-by-destination`),
                axios.get(`${BACKEND_URL}/api/missing-dates`),
                axios.get(`${BACKEND_URL}/api/last-franchise-import-date`)
            ]);
            setAwbsByDestination(Array.isArray(destRes.data) ? destRes.data : []);
            setMissingDates(typeof datesRes.data === 'object' && datesRes.data !== null ? datesRes.data : {});
            setLastFranchiseUpdate(lastImportRes.data.last_update);
        } catch (err) {
            console.error('[CombinedData] Erro ao buscar dados do dashboard:', err);
            showToast('Aviso', 'Não foi possível carregar os cards de resumo.', 'warning');
        } finally {
            setCardsLoading(false);
        }
    }, [BACKEND_URL, showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // --- LÓGICA DE FILTRO LOCAL ---
    useEffect(() => {
        if (!generalFilter.trim()) {
            setFilteredLocalData(fullData);
        } else {
            const lowerCaseFilter = generalFilter.toLowerCase();
            const filtered = fullData.filter((row) =>
                Object.values(row).some((value) => String(value).toLowerCase().includes(lowerCaseFilter))
            );
            setFilteredLocalData(filtered);
        }
        setPage(0);
    }, [generalFilter, fullData]);

    // --- MANIPULADORES DE EVENTOS (Paginação, Ordenação, etc.) ---
    const handleRequestSort = (event, property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
        setPage(0);
    };

    // --- DADOS A SEREM EXIBIDOS ---
    const currentItems = useMemo(() => {
        return stableSort(filteredLocalData, getComparator(order, orderBy))
            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filteredLocalData, order, orderBy, page, rowsPerPage]);

    // --- AÇÕES (Exportar, etc.) ---
    const exportToExcel = useCallback(() => {
        if (filteredLocalData.length === 0) {
            showToast('Aviso', 'Não há dados para exportar.', 'warning');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(filteredLocalData); // Mapeamento pode ser adicionado aqui
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Dados_Termos_AWB');
        XLSX.writeFile(wb, `dados_controle_mcz_${new Date().toISOString().split('T')[0]}.xlsx`);
        logActivity('Exportação para Excel', { totalRegistros: filteredLocalData.length }, true);
    }, [filteredLocalData, showToast]);

    // Expondo funções para o componente pai (DadosCombinadosPage)
    useImperativeHandle(ref, () => ({
        fetchData: fetchData,
        showFranchiseModal: () => importActionsRef.current?.showFranchiseModal(),
        showTermosModal: () => importActionsRef.current?.showTermosModal(),
    }));

    return (
        <Box>
            <Typography variant="h4" component="h1" align="center" sx={{ mb: 2, mt: 2 }}>
                Análise de Termos da SEFAZ-AL
            </Typography>

            {/* Este componente agora é invisível, apenas provê a lógica dos modais */}
            <ImportActions ref={importActionsRef} onProcessingChange={(processing) => {
                onProcessing(processing); // <-- ADICIONE ESTA LINHA
                if (!processing) {
                    fetchData();
                    fetchDashboardData();
                }
            }} />


            <Box sx={{ width: '100%', borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={selectedTab} onChange={handleTabChange} aria-label="abas de dados" centered>
                    <Tab label="Controle" />
                    <Tab label="Acompanhamento" disabled />
                </Tabs>
            </Box>

            {/* Filtro e Ações da Tabela */}
            <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <TextField
                        label="Filtrar Tabela"
                        variant="outlined"
                        size="small"
                        value={generalFilter}
                        onChange={(e) => setGeneralFilter(e.target.value)}
                        placeholder="Buscar em todos os campos..."
                        sx={{ minWidth: '250px', flexGrow: 1 }}
                    />
                    <Button variant="contained" color="success" onClick={exportToExcel} startIcon={<FontAwesomeIcon icon={faFileExcel} />}>
                        Exportar para Excel
                    </Button>
                </Box>
            </Paper>

            <CombinedDataTable
                loading={tableLoading}
                items={currentItems}
                order={order}
                orderBy={orderBy}
                onRequestSort={handleRequestSort}
            />

            <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={filteredLocalData.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Linhas por página:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
            />
            <SummaryCards
                loading={cardsLoading}
                awbsByDestination={awbsByDestination}
                missingDates={missingDates}
                lastFranchiseUpdate={lastFranchiseUpdate}
            />
        </Box>
    );
});

export default CombinedData;