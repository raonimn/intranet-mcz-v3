// frontend/src/components/CombinedData.jsx

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/free-solid-svg-icons";
import Toast from "react-bootstrap/Toast";
import ToastContainer from "react-bootstrap/ToastContainer";
import ImportActions from "./ImportActions";
import * as XLSX from "xlsx";
import logActivity from "../utils/logService";

// --- IMPORTS DO MUI ---
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Tooltip,
  IconButton,
  CircularProgress,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  Chip,
  TextField,
  Button,
  TableSortLabel, // Import para ordenação
} from "@mui/material";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

// -----------------------------------------------------------
// Componentes e Funções Auxiliares
// -----------------------------------------------------------

// --- Funções Auxiliares para Ordenação ---
function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator(order, orderBy) {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) {
      return order;
    }
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}
// --- FIM das Funções Auxiliares de Ordenação ---

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

// -----------------------------------------------------------
// Componente Principal CombinedData
// -----------------------------------------------------------

function CombinedData({ filters, isSidebarOpen, onTermosImported }, ref) {
  // Estados de dados e UI
  const [fullData, setFullData] = useState([]);
  const [filteredLocalData, setFilteredLocalData] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados dos cards de sumário
  const [awbsByDestination, setAwbsByDestination] = useState([]);
  const [missingDates, setMissingDates] = useState({});
  const [lastFranchiseUpdate, setLastFranchiseUpdate] = useState("N/A");

  // Estados de controle (Toast, Filtro, Abas)
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
    title: "",
  });
  const [generalFilter, setGeneralFilter] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);

  // Estados de Paginação
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Estados de Ordenação
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("numero_termo");

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  // --- Lógica de Ordenação ---
  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const headCells = [
    { id: "numero_termo", label: "Termo" },
    { id: "data_emissao", label: "Dt Emissão" },
    { id: "awb", label: "AWB" },
    { id: "fr_data_emissao", label: "Emissão FR" },
    { id: "fr_origem", label: "Origem" },
    { id: "fr_destino", label: "Destino" },
    { id: "fr_tomador", label: "Tomador" },
    { id: "fr_destinatario", label: "Destinatário" },
    { id: "numero_voo", label: "Voo" },
    { id: "chave_nfe", label: "NFe", sortable: false },
    { id: "chave_mdfe", label: "MDFe", sortable: false },
    { id: "sefaz_status_situacao", label: "Status" },
  ];

  // --- Funções e Callbacks ---
  const handleTabChange = useCallback((event, newValue) => {
    setSelectedTab(newValue);
    setPage(0);
  }, []);

  const showAppToast = useCallback((title, message, type) => {
    setToast({ show: true, title, message, type });
  }, []);

  // Funções de Fetch
  const fetchAwbsByDestination = useCallback(async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/awbs-by-destination`
      );
      setAwbsByDestination(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("[CombinedData] Erro ao buscar AWBs por destino:", err);
      setAwbsByDestination([]);
    }
  }, [BACKEND_URL]);

  const fetchMissingDates = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/missing-dates`);
      setMissingDates(
        typeof response.data === "object" && response.data !== null
          ? response.data
          : {}
      );
    } catch (err) {
      console.error("[CombinedData] Erro ao buscar datas faltantes:", err);
      setMissingDates({});
    }
  }, [BACKEND_URL]);

  const fetchLastFranchiseImportDate = useCallback(async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/last-franchise-import-date`
      );
      setLastFranchiseUpdate(response.data.last_update);
    } catch (err) {
      console.error(
        "[CombinedData] Erro ao buscar última data de importação:",
        err
      );
      setLastFranchiseUpdate("N/A");
    }
  }, [BACKEND_URL]);

  const fetchData = useCallback(async () => {
    setTableLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await axios.get(
        `${BACKEND_URL}/api/combined-data-specific?${queryParams.toString()}`
      );
      setFullData(Array.isArray(response.data) ? response.data : []);
      setPage(0);
    } catch (err) {
      setError(
        "Erro ao buscar os dados: " +
          (err.response?.data?.message || err.message)
      );
      setFullData([]);
    } finally {
      setTableLoading(false);
    }
  }, [filters, BACKEND_URL]);

  const handleProcessingChange = useCallback(
    (processing, type, extractedData) => {
      setIsProcessing(processing);
      if (!processing) {
        fetchData();
        fetchAwbsByDestination();
        fetchMissingDates();
        fetchLastFranchiseImportDate();
        if (type === "termos" && extractedData) {
          onTermosImported("extractedTerms", extractedData);
        }
      }
    },
    [
      fetchData,
      fetchAwbsByDestination,
      fetchMissingDates,
      onTermosImported,
      fetchLastFranchiseImportDate,
    ]
  );

  // Efeitos
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCardsLoading(true);
    Promise.all([
      fetchAwbsByDestination(),
      fetchMissingDates(),
      fetchLastFranchiseImportDate(),
    ]).finally(() => setCardsLoading(false));
  }, [fetchAwbsByDestination, fetchMissingDates, fetchLastFranchiseImportDate]);

  useEffect(() => {
    const dataToFilter = Array.isArray(fullData) ? fullData : [];
    if (!generalFilter.trim()) {
      setFilteredLocalData(dataToFilter);
    } else {
      const lowerCaseFilter = generalFilter.toLowerCase();
      const filtered = dataToFilter.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(lowerCaseFilter)
        )
      );
      setFilteredLocalData(filtered);
      setPage(0);
    }
  }, [generalFilter, fullData]);

  // Funções de Utilitário
  const copyToClipboard = useCallback(
    async (text, type) => {
      try {
        await navigator.clipboard.writeText(text);
        showAppToast("Copiado!", `${type} copiado: ${text}`, "info");
      } catch (err) {
        showAppToast("Erro", "Erro ao copiar.", "danger");
      }
    },
    [showAppToast]
  );

  const copyAwbLast8Digits = useCallback(
    (awb) => {
      if (awb && String(awb).length >= 8) {
        copyToClipboard(String(awb).slice(-8), "AWB (8 últimos dígitos)");
      }
    },
    [copyToClipboard]
  );

  const formatNumber = (num) => new Intl.NumberFormat("pt-BR").format(num);

  // Lógica de Paginação MUI
  const handleChangePage = useCallback(
    (event, newPage) => setPage(newPage),
    []
  );
  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Dados para exibição na página atual (com ordenação e paginação)
  const currentItems = React.useMemo(() => {
    if (!filteredLocalData || !Array.isArray(filteredLocalData)) return [];
    const sortedData = stableSort(
      filteredLocalData,
      getComparator(order, orderBy)
    );
    return sortedData.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredLocalData, page, rowsPerPage, order, orderBy]);

  const totalAwbsCalculated = Array.isArray(awbsByDestination)
    ? awbsByDestination.reduce((sum, item) => sum + item.total_awbs, 0)
    : 0;

  const getRowClassName = useCallback((status) => {
    if (!status) return "";
    const statusLowerCase = status.toLowerCase();
    const redStatuses = [
      "pendente de pagamento",
      "pendente (enviar e-mail)",
      "pago com restrição",
    ];
    const greenStatuses = ["liberação autorizada", "liberado"];
    if (redStatuses.includes(statusLowerCase)) return "row-red";
    if (greenStatuses.includes(statusLowerCase)) return "row-green";
    if (statusLowerCase !== "pendente") return "row-yellow";
    return "";
  }, []);

  // Expondo funções para o componente pai
  const importActionsInternalRef = useRef(null);
  useImperativeHandle(ref, () => ({
    showFranchiseModal: () =>
      importActionsInternalRef.current.showFranchiseModal(),
    showTermosModal: () => importActionsInternalRef.current.showTermosModal(),
    showStatusTermosModal: () =>
      importActionsInternalRef.current.showStatusTermosModal(),
    fetchData: fetchData,
  }));

  const exportToExcel = useCallback(() => {
    const dataForExport = Array.isArray(filteredLocalData)
      ? filteredLocalData
      : [];
    if (dataForExport.length === 0) {
      showAppToast("Aviso", "Não há dados para exportar.", "warning");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(
      dataForExport.map((row) => ({
        /* mapeamento de colunas */
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados_Termos_AWB");
    XLSX.writeFile(wb, "dados_termos_awb.xlsx");
    logActivity(
      "Exportação de Excel Concluída",
      { totalRegistros: dataForExport.length },
      true
    );
  }, [filteredLocalData, showAppToast]);

  return (
    <Box
      sx={{
        p: 2,
        ml: isSidebarOpen ? "250px" : 0,
        transition: "margin-left 0.3s",
      }}
    >
      {isProcessing && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 2001,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <CircularProgress color="inherit" size={60} />
          <Typography variant="h6" color="white" ml={2}>
            Processando...
          </Typography>
        </Box>
      )}

      <Typography
        variant="h4"
        component="h2"
        align="center"
        sx={{ mb: 2, mt: 2 }}
      >
        Análise de Termos da SEFAZ-AL
      </Typography>

      <ToastContainer
        position="top-end"
        className="p-3"
        style={{ zIndex: 1051 }}
      >
        <Toast
          onClose={() => setToast({ ...toast, show: false })}
          show={toast.show}
          delay={5000}
          autohide
          bg={toast.type}
        >
          <Toast.Header>
            <strong className="me-auto">{toast.title}</strong>
            <small>Agora</small>
          </Toast.Header>
          <Toast.Body
            className={toast.type === "light" ? "text-dark" : "text-white"}
          >
            {toast.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>

      <ImportActions
        onProcessingChange={handleProcessingChange}
        showToast={showAppToast}
        ref={importActionsInternalRef}
      />

      

      <Box
        sx={{ width: "100%", borderBottom: 1, borderColor: "divider", mb: 3 }}
      >
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          aria-label="abas de dados"
          centered
        >
          <Tab label="Controle" {...a11yProps(0)} />
          <Tab label="Acompanhamento" {...a11yProps(1)} />
        </Tabs>
      </Box>

      <TabPanel value={selectedTab} index={0}>
        <Paper elevation={3} sx={{ p: 2, mb: 4 }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <TextField
              id="generalFilter"
              label="Filtrar Tabela"
              variant="outlined"
              size="small"
              value={generalFilter}
              onChange={(e) => setGeneralFilter(e.target.value)}
              placeholder="Buscar em todas as colunas..."
              sx={{ minWidth: "250px", flexGrow: 1 }}
            />
            <Button
              variant="contained"
              color="success"
              onClick={exportToExcel}
              startIcon={<FontAwesomeIcon icon={faCopy} />}
            >
              Exportar para Excel
            </Button>
          </Box>
        </Paper>

        {tableLoading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "300px",
            }}
          >
            <CircularProgress color="primary" />
          </Box>
        ) : (
          <TableContainer component={Paper} elevation={3}>
            <Table stickyHeader aria-label="tabela de dados combinados">
              <TableHead>
                <TableRow>
                  {headCells.map((headCell) => (
                    <TableCell
                      key={headCell.id}
                      sortDirection={orderBy === headCell.id ? order : false}
                    >
                      {headCell.sortable === false ? (
                        headCell.label
                      ) : (
                        <TableSortLabel
                          active={orderBy === headCell.id}
                          direction={orderBy === headCell.id ? order : "asc"}
                          onClick={(event) =>
                            handleRequestSort(event, headCell.id)
                          }
                        >
                          {headCell.label}
                        </TableSortLabel>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {currentItems.map((row, index) => (
                  <TableRow
                    key={index}
                    className={getRowClassName(row.sefaz_status_situacao)}
                  >
                    <TableCell>{row.numero_termo || "N/A"}</TableCell>
                    <TableCell>{row.data_emissao || "N/A"}</TableCell>
                    <TableCell
                      onClick={() => copyAwbLast8Digits(row.awb)}
                      sx={{ cursor: "pointer", fontWeight: "bold" }}
                    >
                      {row.awb || "N/A"}
                    </TableCell>
                    <TableCell>{row.fr_data_emissao || "N/A"}</TableCell>
                    <TableCell>{row.fr_origem || "N/A"}</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      {row.fr_destino || "N/A"}
                    </TableCell>
                    <TableCell sx={{ textAlign: "left" }}>
                      {row.fr_tomador || "N/A"}
                    </TableCell>
                    <TableCell sx={{ textAlign: "left" }}>
                      {row.fr_destinatario || "N/A"}
                    </TableCell>
                    <TableCell>{row.numero_voo || "N/A"}</TableCell>
                    <TableCell>
                      {row.chave_nfe ? (
                        <Tooltip title={row.chave_nfe}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(row.chave_nfe, "Chave NFe");
                            }}
                            color="primary"
                          >
                            <FontAwesomeIcon icon={faCopy} size="xs" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      {row.chave_mdfe ? (
                        <Tooltip title={row.chave_mdfe}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(row.chave_mdfe, "Chave MDFe");
                            }}
                            color="primary"
                          >
                            <FontAwesomeIcon icon={faCopy} size="xs" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      {row.sefaz_status_situacao || "Não Informado"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredLocalData.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Linhas por página:"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
              }
            />
          </TableContainer>
        )}
      </TabPanel>

      <TabPanel value={selectedTab} index={1}>
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" component="p" align="center">
            Conteúdo da aba "Acompanhamento" será implementado aqui.
          </Typography>
        </Paper>
      </TabPanel>
      {cardsLoading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "150px",
          }}
        >
          <CircularProgress color="secondary" />
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 3,
            mb: 4,
            mt: 2
          }}
        >
          {/* Cards de Sumário */}
          <Card
            raised
            sx={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            <CardHeader
              title="AWBs Registrados no Banco"
              titleTypographyProps={{ variant: "h6", align: "center" }}
            />
            <CardContent
              sx={{ flexGrow: 1, overflowY: "auto", maxHeight: "300px" }}
            >
              <List dense>
                {awbsByDestination.map((item, idx) => (
                  <ListItem
                    key={idx}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <ListItemText primary={item.destino || "N/A"} />
                    <Chip
                      label={formatNumber(item.total_awbs)}
                      color="primary"
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
            <CardActions
              sx={{
                justifyContent: "center",
                p: 1,
                backgroundColor: "action.hover",
              }}
            >
              <Typography variant="subtitle1" fontWeight="bold">
                Total: {formatNumber(totalAwbsCalculated)} -{" "}
                {lastFranchiseUpdate}
              </Typography>
            </CardActions>
          </Card>
          <Card
            raised
            sx={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            <CardHeader
              title="Datas Faltantes (últimos 30 dias)"
              titleTypographyProps={{ variant: "h6", align: "center" }}
            />
            <CardContent
              sx={{ flexGrow: 1, overflowY: "auto", maxHeight: "300px" }}
            >
              <List dense>
                {Object.entries(missingDates || {}).map(
                  ([destino, dates], idx) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={
                          <Typography component="span" fontWeight="bold">
                            {destino || "N/A"}:
                          </Typography>
                        }
                        secondary={
                          Array.isArray(dates) && dates.length > 0
                            ? dates.join(", ")
                            : "Todas as datas presentes."
                        }
                      />
                    </ListItem>
                  )
                )}
              </List>
            </CardContent>
          </Card>
          <Card
            raised
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CardHeader
              title="Malha de Voos"
              titleTypographyProps={{ variant: "h6", align: "center" }}
            />
            <CardContent
              sx={{
                flexGrow: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                align="center"
              >
                (Funcionalidade em desenvolvimento)
              </Typography>
              <CircularProgress color="info" size={30} sx={{ mt: 2 }} />
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}

export default forwardRef(CombinedData);
