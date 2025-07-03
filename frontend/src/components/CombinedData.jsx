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
} from "@mui/material";

// IMPORTS PARA AS ABAS
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

// -----------------------------------------------------------
// Componentes Auxiliares
// -----------------------------------------------------------

// Componente TabPanel
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

// Função auxiliar para acessibilidade das abas
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
  const [fullData, setFullData] = useState([]);
  const [filteredLocalData, setFilteredLocalData] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);

  const [awbsByDestination, setAwbsByDestination] = useState([]);
  const [missingDates, setMissingDates] = useState({});
  const [lastFranchiseUpdate, setLastFranchiseUpdate] = useState("N/A");

  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
    title: "",
  });

  const [generalFilter, setGeneralFilter] = useState("");

  // Paginação MUI
  const [page, setPage] = useState(0); // Índice da página (MUI é 0-based)
  const [rowsPerPage, setRowsPerPage] = useState(10); // Linhas por página

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const [selectedTab, setSelectedTab] = useState(0);

  const handleTabChange = useCallback((event, newValue) => {
    setSelectedTab(newValue);
    setPage(0); // Resetar paginação ao mudar de aba, se a aba tiver tabela
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
      showAppToast("Erro", "Falha ao carregar AWBs por destino.", "danger");
      setAwbsByDestination([]);
    }
  }, [BACKEND_URL, showAppToast]);

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
      showAppToast("Erro", "Falha ao carregar datas faltantes.", "danger");
      setMissingDates({});
    }
  }, [BACKEND_URL, showAppToast]);

  const fetchLastFranchiseImportDate = useCallback(async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/last-franchise-import-date`
      );
      setLastFranchiseUpdate(response.data.last_update);
    } catch (err) {
      console.error(
        "[CombinedData] Erro ao buscar última data de importação de franchise:",
        err
      );
      setLastFranchiseUpdate("N/A");
    }
  }, [BACKEND_URL]);

  const fetchData = useCallback(async () => {
    setTableLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters.voo && filters.voo.trim()) {
        queryParams.append("numeroVoo", filters.voo.trim());
      }
      if (filters.dataTermo && filters.dataTermo.trim()) {
        queryParams.append("dataTermo", filters.dataTermo.trim());
      }
      if (filters.awb && filters.awb.trim()) {
        queryParams.append("awb", filters.awb.trim());
      }
      if (filters.termo && filters.termo.trim()) {
        queryParams.append("numeroTermo", filters.termo.trim());
      }
      if (filters.destino && filters.destino.trim()) {
        queryParams.append("destino", filters.destino.trim());
      }

      const response = await axios.get(
        `${BACKEND_URL}/api/combined-data-specific?${queryParams.toString()}`
      );
      setFullData(Array.isArray(response.data) ? response.data : []);
      setPage(0); // Resetar página para 0 ao buscar novos dados
    } catch (err) {
      setError(
        "Erro ao buscar os dados: " +
          (err.response?.data?.message || err.message)
      );
      console.error("[CombinedData] Erro ao buscar dados combinados:", err);
      showAppToast(
        "Erro",
        `Falha ao carregar dados combinados: ${
          err.response?.data?.message || err.message
        }`,
        "danger"
      );
      setFullData([]);
    } finally {
      setTableLoading(false);
    }
  }, [filters, BACKEND_URL, showAppToast]);

  const handleProcessingChange = useCallback(
    (processing, type, extractedData) => {
      setIsProcessing(processing);
      if (!processing) {
        fetchData(); // Refresca os dados da tabela
        fetchAwbsByDestination(); // Refresca os cards
        fetchMissingDates(); // Refresca os cards
        fetchLastFranchiseImportDate(); // Refresca a data do card de franchise

        if (type === "termos" && extractedData) {
          onTermosImported("extractedTerms", extractedData);
          logActivity(
            "Importação de Termos Concluída",
            {
              voo:
                extractedData.length > 0 ? extractedData[0].numero_voo : "N/A",
              totalRegistros: extractedData.length,
            },
            true
          );
        } else if (type === "franchise") {
          logActivity(
            "Importação de Franchise Concluída",
            {
              message: "Relatório de Franchise importado.",
            },
            true
          );
        } else if (type === "statusTermos") {
          logActivity(
            "Importação de Status de Termos Concluída",
            { message: "Status de termos atualizados." },
            true
          );
        }
      } else {
        logActivity(
          `Início da Importação: ${type === "termos" ? "Termos" : "Franchise"}`,
          {},
          true
        );
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

  // Efeitos para carregar dados
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCardsLoading(true);
    Promise.all([
      fetchAwbsByDestination(),
      fetchMissingDates(),
      fetchLastFranchiseImportDate(),
    ]).finally(() => {
      setCardsLoading(false);
    });
  }, [fetchAwbsByDestination, fetchMissingDates, fetchLastFranchiseImportDate]);

  // Efeito para filtrar dados localmente com o filtro geral
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
      setPage(0); // Resetar página ao filtrar
    }
  }, [generalFilter, fullData]);

  const copyToClipboard = useCallback(
    async (text, type) => {
      try {
        await navigator.clipboard.writeText(text);
        showAppToast("Copiado!", `${type} copiado: ${text}`, "info");
      } catch (err) {
        console.error(
          "[CombinedData] Erro ao copiar para a área de transferência:",
          err
        );
        showAppToast(
          "Erro",
          "Erro ao copiar. Por favor, tente novamente.",
          "danger"
        );
      }
    },
    [showAppToast]
  );

  const copyAwbLast8Digits = useCallback(
    (awb) => {
      if (awb && String(awb).length >= 8) {
        const last8Digits = String(awb).slice(-8);
        copyToClipboard(last8Digits, "AWB (8 últimos dígitos)");
      } else {
        showAppToast(
          "Aviso",
          "AWB muito curto para copiar 8 dígitos.",
          "warning"
        );
      }
    },
    [copyToClipboard, showAppToast]
  );

  const formatNumber = (num) => new Intl.NumberFormat("pt-BR").format(num);

  const totalAwbsCalculated = Array.isArray(awbsByDestination)
    ? awbsByDestination.reduce((sum, item) => sum + item.total_awbs, 0)
    : 0;

  // Lógica de Paginação MUI
  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Dados para exibição na página atual
  const currentItems = React.useMemo(() => {
    if (!filteredLocalData || !Array.isArray(filteredLocalData)) return [];
    return filteredLocalData.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredLocalData, page, rowsPerPage]);

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
      logActivity("Tentativa de Exportar Excel (Sem Dados)", {}, false);
      return;
    }

    const ws = XLSX.utils.json_to_sheet(
      dataForExport.map((row) => ({
        Termo: row.numero_termo || "N/A",
        "Dt Emissão": row.data_emissao || "N/A",
        AWB: row.awb || "N/A",
        "Emissão FR": row.fr_data_emissao || "N/A",
        Origem: row.fr_origem || "N/A",
        Destino: row.fr_destino || "N/A",
        Tomador: row.fr_tomador || "N/A",
        Destinatário: row.fr_destinatario || "N/A",
        Voo: row.numero_voo || "N/A",
        NFe: row.chave_nfe || "N/A",
        MDFe: row.chave_mdfe || "N/A",
        "Nº CT-e": row.numero_cte || "N/A",
        "Nº NFe do Termo": row.numero_nfe || "N/A",
        "Chave CT-e FR": row.fr_chave_cte || "N/A",
        "Notas FR": row.fr_notas || "N/A",
        "Status Termo": row.sefaz_status_situacao || "N/A",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados_Termos_AWB");
    XLSX.writeFile(wb, "dados_termos_awb.xlsx");
    showAppToast("Sucesso", "Dados exportados para Excel!", "success");
    logActivity(
      "Exportação de Excel Concluída",
      { totalRegistros: dataForExport.length },
      true
    );
  }, [filteredLocalData, showAppToast]);

  // --- FUNÇÃO PARA DETERMINAR A COR DE BACKGROUND DA LINHA (usando classes CSS) ---
  // (Estava como era antes da tentativa de usar style={{ backgroundColor }} )
  const getRowClassName = useCallback((status) => {
    if (!status) return "";

    const statusLowerCase = status.toLowerCase();

    const redStatuses = [
      "pendente de pagamento",
      "pendente (enviar e-mail)",
      "pago com restrição",
    ];
    if (redStatuses.includes(statusLowerCase)) {
      return "row-red";
    }

    const greenStatuses = ["liberação autorizada", "liberado"];
    if (greenStatuses.includes(statusLowerCase)) {
      return "row-green";
    }

    if (statusLowerCase !== "pendente") {
      return "row-yellow";
    }

    return "";
  }, []);

  return (
    <Box // Usando Box para o layout principal (já estava assim)
      sx={{
        p: 2,
        ml: isSidebarOpen ? "250px" : 0,
        transition: "margin-left 0.3s",
      }}
    >
      {isProcessing && (
        <Box // Usando Box para o overlay (já estava assim)
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

      {/* ToastContainer como estava antes do posicionamento fixo via Box sx */}
      {/* Ele estava com position="top-end" e classe "p-3", mas sem o 'fixed' no style inline */}
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

      {cardsLoading ? (
        <Box // Cards de sumário eram divs com classes Bootstrap, agora são Boxes MUI
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "150px",
          }}
        >
          <CircularProgress color="secondary" />
          <Typography variant="body1" ml={2}>
            Carregando dados de sumário...
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 3,
            mb: 4,
          }}
        >
          {/* Card: AWBs Registrados no banco (agora MUI Card) */}
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
                {Array.isArray(awbsByDestination) &&
                awbsByDestination.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="Nenhum dado de destino encontrado." />
                  </ListItem>
                ) : (
                  awbsByDestination.map((item, idx) => (
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
                  ))
                )}
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
                Total de AWBs: {formatNumber(totalAwbsCalculated)} -{" "}
                {lastFranchiseUpdate}
              </Typography>
            </CardActions>
          </Card>

          {/* Card: Datas Faltantes (agora MUI Card) */}
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
                {typeof missingDates === "object" &&
                Object.keys(missingDates).length === 0 ? (
                  <ListItem>
                    <ListItemText primary="Verificando datas faltantes..." />
                  </ListItem>
                ) : (
                  Object.entries(missingDates || {}).map(
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
                  )
                )}
              </List>
            </CardContent>
          </Card>

          {/* Card: Malha de Voos (agora MUI Card) */}
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
                variant="body1"
                color="text.secondary"
                align="center"
                mb={1}
              >
                Conteúdo da malha de voos será exibido aqui.
              </Typography>
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

      {/* --- SEÇÃO DE ABAS --- */}
      {/* Componentes Box, Tabs e Tab do MUI já estavam sendo usados */}
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

      {/* Conteúdo da Aba "Controle" */}
      <TabPanel value={selectedTab} index={0}>
        <Paper elevation={3} sx={{ p: 2, mb: 4 }}>
          {" "}
          {/* Agora usa Paper MUI */}
          <Typography variant="h6" align="center" sx={{ mb: 2 }}>
            Pesquisa e Ações na Tabela
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <TextField // TextField MUI
              id="generalFilter"
              label="Filtrar Tabela"
              variant="outlined"
              size="small"
              value={generalFilter}
              onChange={(e) => setGeneralFilter(e.target.value)}
              placeholder="Buscar em todas as colunas..."
              sx={{ minWidth: "250px", flexGrow: 1 }}
            />
            <Button // Button MUI
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
          <Box // Spinner de carregamento agora é Box MUI
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "300px",
            }}
          >
            <CircularProgress color="primary" />
            <Typography variant="body1" ml={2}>
              Carregando dados da tabela...
            </Typography>
          </Box>
        ) : Array.isArray(filteredLocalData) &&
          filteredLocalData.length === 0 ? (
          <Typography // Alerta de nenhum dado é Typography MUI
            variant="body1"
            align="center"
            color="info.main"
            sx={{
              p: 3,
              border: "1px solid",
              borderColor: "info.main",
              borderRadius: 1,
            }}
          >
            Nenhum dado encontrado para os critérios de filtro.
          </Typography>
        ) : (
          <TableContainer component={Paper} elevation={3}>
            {" "}
            {/* Tabela MUI */}
            <Table stickyHeader aria-label="tabela de dados combinados">
              <TableHead>
                <TableRow>
                  <TableCell>Termo</TableCell>
                  <TableCell>Dt Emissão</TableCell>
                  <TableCell>AWB</TableCell>
                  <TableCell>Emissão FR</TableCell>
                  <TableCell>Origem</TableCell>
                  <TableCell>Destino</TableCell>
                  <TableCell>Tomador</TableCell>
                  <TableCell>Destinatário</TableCell>
                  <TableCell>Voo</TableCell>
                  <TableCell>NFe</TableCell>
                  <TableCell>MDFe</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentItems.map((row, index) => (
                  <TableRow
                    key={index}
                    className={getRowClassName(row.sefaz_status_situacao)} // Ainda usando classe CSS
                  >
                    <TableCell component="th" scope="row">
                      {row.numero_termo || "N/A"}
                    </TableCell>
                    <TableCell>{row.data_emissao || "N/A"}</TableCell>
                    <TableCell
                      onClick={() => copyAwbLast8Digits(row.awb)}
                      sx={{ cursor: "pointer", fontWeight: "bold" }} // Mantém sx styles para td
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
                          {" "}
                          {/* Tooltip MUI */}
                          <IconButton // IconButton MUI
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
                          {" "}
                          {/* Tooltip MUI */}
                          <IconButton // IconButton MUI
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
            <TablePagination // Paginação MUI
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

      {/* Conteúdo da Aba "Acompanhamento" */}
      <TabPanel value={selectedTab} index={1}>
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
          {" "}
          {/* Paper MUI */}
          <Typography variant="h6" component="p" align="center">
            Conteúdo da aba "Acompanhamento" será implementado aqui.
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mt: 1 }}
          >
            (Ex: status de movimentação de AWBs, gráficos, etc.)
          </Typography>
        </Paper>
      </TabPanel>
    </Box>
  );
}

export default forwardRef(CombinedData);
