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

// Função auxiliar para máscara de data (mantida)
const applyDateMask = (value) => {
  value = value.replace(/\D/g, "");
  if (value.length > 4) {
    value = value.replace(/^(\d{2})(\d{2})(\d{4}).*/, "$1/$2/$3");
  } else if (value.length > 2) {
    value = value.replace(/^(\d{2})(\d{2}).*/, "$1/$2");
  }
  return value;
};

// TooltipWrapper (mantido)
const TooltipWrapper = ({ children, title }) => {
  return (
    <span
      data-bs-toggle="tooltip"
      data-bs-placement="top"
      data-bs-title={title}
      title={title}
    >
      {children}
    </span>
  );
};

function CombinedData({ filters, isSidebarOpen, onTermosImported }, ref) {
  const [fullData, setFullData] = useState([]); // Dados brutos carregados do backend
  const [filteredLocalData, setFilteredLocalData] = useState([]); // Dados filtrados localmente
  const [cardsLoading, setCardsLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);

  const [awbsByDestination, setAwbsByDestination] = useState([]);
  const [missingDates, setMissingDates] = useState({});

  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const [generalFilter, setGeneralFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const showAppToast = useCallback((title, message, type) => {
    setToast({ show: true, title, message, type });
  }, []);

  const fetchAwbsByDestination = useCallback(async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/awbs-by-destination`
      );
      // Garanta que awbsByDestination sempre comece como um array vazio se a resposta for inválida
      setAwbsByDestination(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Erro ao buscar AWBs por destino:", err);
      showAppToast("Erro", "Falha ao carregar AWBs por destino.", "danger");
      setAwbsByDestination([]); // Define como array vazio em caso de erro
    }
  }, [BACKEND_URL, showAppToast]);

  const fetchMissingDates = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/missing-dates`);
      // Garanta que missingDates sempre comece como um objeto vazio se a resposta for inválida
      setMissingDates(
        typeof response.data === "object" && response.data !== null
          ? response.data
          : {}
      );
    } catch (err) {
      console.error("Erro ao buscar datas faltantes:", err);
      showAppToast("Erro", "Falha ao carregar datas faltantes.", "danger");
      setMissingDates({}); // Define como objeto vazio em caso de erro
    }
  }, [BACKEND_URL, showAppToast]);

  const fetchData = useCallback(async () => {
    setTableLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters.voo && filters.voo.trim()) {
        queryParams.append("numeroVoo", filters.voo.trim());
      }
      if (filters.dataTermo && filters.dataTermo.trim()) {
        queryParams.append("dataRegistro", filters.dataTermo.trim());
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
      // GARANTIR QUE fullData seja sempre um array
      setFullData(Array.isArray(response.data) ? response.data : []);
      setCurrentPage(1);
    } catch (err) {
      setError(
        "Erro ao buscar os dados: " +
          (err.response?.data?.message || err.message)
      );
      console.error("Erro ao buscar dados combinados:", err);
      showAppToast(
        "Erro",
        `Falha ao carregar dados combinados: ${
          err.response?.data?.message || err.message
        }`,
        "danger"
      );
      setFullData([]); // Definir como array vazio em caso de erro
    } finally {
      setTableLoading(false);
    }
  }, [filters, BACKEND_URL, showAppToast]);

  const handleProcessingChange = useCallback(
    (processing, type, extractedData) => {
      setIsProcessing(processing);
      if (!processing) {
        fetchData();
        fetchAwbsByDestination();
        fetchMissingDates();

        // if (type === 'termos' && extractedData) { // Lógica para o modal removido
        //     onTermosImported('extractedTerms', extractedData);
        // }
      }
    },
    [fetchData, fetchAwbsByDestination, fetchMissingDates]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCardsLoading(true);
    Promise.all([fetchAwbsByDestination(), fetchMissingDates()]).finally(() => {
      setCardsLoading(false);
    });
  }, [fetchAwbsByDestination, fetchMissingDates]);

  useEffect(() => {
    // Garantir que fullData é um array antes de filtrar
    const dataToFilter = Array.isArray(fullData) ? fullData : [];

    if (!generalFilter.trim()) {
      setFilteredLocalData(dataToFilter);
    } else {
      const lowerCaseFilter = generalFilter.toLowerCase();
      const filtered = dataToFilter.filter(
        (
          row // Usar dataToFilter
        ) =>
          Object.values(row).some((value) =>
            String(value).toLowerCase().includes(lowerCaseFilter)
          )
      );
      setFilteredLocalData(filtered);
      setCurrentPage(1);
    }
  }, [generalFilter, fullData]); // Depende de fullData

  const copyToClipboard = useCallback(
    async (text, type) => {
      try {
        await navigator.clipboard.writeText(text);
        showAppToast("Copiado!", `${type} copiado: ${text}`, "info");
      } catch (err) {
        console.error("Erro ao copiar para a área de transferência:", err);
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
      if (awb && awb.length >= 8) {
        const last8Digits = awb.slice(-8);
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

  // Garantir que awbsByDestination é um array antes de reduce
  const totalAwbsCalculated = Array.isArray(awbsByDestination)
    ? awbsByDestination.reduce((sum, item) => sum + item.total_awbs, 0)
    : 0;

  // Paginação agora baseada em filteredLocalData
  // Garantir que filteredLocalData é um array antes de slice
  const dataForPagination = Array.isArray(filteredLocalData)
    ? filteredLocalData
    : [];
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = dataForPagination.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(dataForPagination.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const renderPaginationButtons = () => {
    const pageNumbers = [];
    // Gerar botões de paginação apenas se houver mais de uma página
    if (totalPages > 1) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(
          <li
            key={i}
            className={`page-item ${currentPage === i ? "active" : ""}`}
          >
            <button onClick={() => paginate(i)} className="page-link">
              {i}
            </button>
          </li>
        );
      }
    }

    return totalPages > 1 ? ( // Renderizar botões apenas se houver mais de uma página
      <ul className="pagination justify-content-center mt-4">
        <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
          <button
            onClick={() => paginate(currentPage - 1)}
            className="page-link"
          >
            Anterior
          </button>
        </li>
        {pageNumbers}
        <li
          className={`page-item ${
            currentPage === totalPages ? "disabled" : ""
          }`}
        >
          <button
            onClick={() => paginate(currentPage + 1)}
            className="page-link"
          >
            Próximo
          </button>
        </li>
      </ul>
    ) : null; // Não renderiza nada se houver apenas uma página
  };

  const importActionsInternalRef = useRef(null);
  useImperativeHandle(ref, () => ({
    showFranchiseModal: () =>
      importActionsInternalRef.current.showFranchiseModal(),
    showTermosModal: () => importActionsInternalRef.current.showTermosModal(),
  }));

  const exportToExcel = () => {
    // Usar dataForPagination (que é filteredLocalData) para a exportação
    if (!dataForPagination || dataForPagination.length === 0) {
      showAppToast("Aviso", "Não há dados para exportar.", "warning");
      return;
    }

    const dataForExport = dataForPagination.map((row) => ({
      Termo: row.numero_termo || "N/A",
      "Dt Termo": row.data_registro || "N/A",
      AWB: row.awb || "N/A",
      "Emissão FR": row.franchise_data_emissao || "N/A",
      Origem: row.origem || "N/A",
      Destino: row.destino || "N/A",
      Tomador: row.tomador || "N/A",
      Destinatário: row.destinatario || "N/A",
      Voo: row.numero_voo || "N/A",
      "Chave NFe": row.chave_nfe || "N/A",
      "Chave MDFe": row.chave_mdfe || "N/A",
      "Nº CT-e": row.numero_cte || "N/A",
      "Nº NFe": row.numero_nfe || "N/A",
      "Dt Emissão SEFAZ": row.sefaz_data_emissao || "N/A",
      "Chave CT-e FR": row.fr_chave_cte || "N/A",
      "Notas FR": row.notas || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(dataForExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados_Termos_AWB");
    XLSX.writeFile(wb, "dados_termos_awb.xlsx");
    showAppToast("Sucesso", "Dados exportados para Excel!", "success");
  };

  return (
    <div className={`container my-4 ${isSidebarOpen ? "content-shifted" : ""}`}>
      {isProcessing && (
        <div
          className="overlay d-flex justify-content-center align-items-center"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1050,
          }}
        >
          <div
            className="spinner-border text-light"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Processando...</span>
          </div>
        </div>
      )}

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
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: "150px" }}
        >
          <div className="spinner-border text-secondary" role="status">
            <span className="visually-hidden">
              Carregando dados de sumário...
            </span>
          </div>
        </div>
      ) : (
        <div className="row mb-4 g-3">
          <div className="col-md-4 mb-3 mb-md-0">
            <div className="card h-100">
              <div className="card-header">
                <h5 className="mb-0">Registros no Banco (AWBs por Destino)</h5>
              </div>
              <div
                className="card-body"
                style={{ maxHeight: "300px", overflowY: "auto" }}
              >
                <ul className="list-group list-group-flush">
                  {Array.isArray(awbsByDestination) &&
                  awbsByDestination.length === 0 ? (
                    <li className="list-group-item">
                      Nenhum dado de destino encontrado.
                    </li>
                  ) : (
                    Array.isArray(awbsByDestination) &&
                    awbsByDestination.map((item, idx) => (
                      <li
                        key={idx}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        {item.destino || "N/A"}
                        <span className="badge bg-primary rounded-pill">
                          {formatNumber(item.total_awbs)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="card-footer text-end">
                <strong>
                  Total de AWBs: {formatNumber(totalAwbsCalculated)}
                </strong>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card h-100">
              <div className="card-header">
                <h5 className="mb-0">Datas Faltantes (últimos 30 dias)</h5>
              </div>
              <div
                className="card-body"
                style={{ maxHeight: "300px", overflowY: "auto" }}
              >
                <ul className="list-group list-group-flush">
                  {typeof missingDates === "object" &&
                  missingDates !== null &&
                  Object.keys(missingDates).length === 0 ? (
                    <li className="list-group-item">
                      Verificando datas faltantes...
                    </li>
                  ) : (
                    Object.entries(missingDates || {}).map(
                      ([destino, dates], idx) => (
                        <li key={idx} className="list-group-item">
                          <strong>{destino || "N/A"}:</strong>{" "}
                          {Array.isArray(dates) && dates.length > 0
                            ? dates.join(", ")
                            : "Todas as datas presentes."}
                        </li>
                      )
                    )
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card h-100">
              <div className="card-header">
                <h5 className="mb-0">Malha de Voos (Próxima Funcionalidade)</h5>
              </div>
              <div className="card-body d-flex flex-column justify-content-center align-items-center">
                <p className="text-muted text-center">
                  Conteúdo da malha de voos será exibido aqui.
                </p>
                <p className="text-muted text-center small">
                  (Funcionalidade em desenvolvimento)
                </p>
                <div
                  className="spinner-grow text-info"
                  role="status"
                  style={{ width: "1.5rem", height: "1.5rem" }}
                >
                  <span className="visually-hidden">Carregando...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-center mb-4">
        Resultado dos Termos da SEFAZ Importados
      </h2>

      <div className="card mb-4">
        <div className="card-header text-center">
          <h5 className="mb-0">Pesquisa e Ações na Tabela</h5>
        </div>
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-center justify-content-center gap-3">
            <label htmlFor="generalFilter" className="form-label mb-0 me-2">
              Filtrar Tabela:
            </label>
            <input
              type="text"
              className="form-control flex-grow-1"
              id="generalFilter"
              value={generalFilter}
              onChange={(e) => setGeneralFilter(e.target.value)}
              placeholder="Buscar em todas as colunas..."
              style={{ maxWidth: "300px" }}
            />
            <button
              type="button"
              className="btn btn-success"
              onClick={exportToExcel}
            >
              Exportar para Excel
            </button>
          </div>
        </div>
      </div>

      {tableLoading ? (
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: "300px" }}
        >
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">
              Carregando dados da tabela...
            </span>
          </div>
        </div>
      ) : Array.isArray(filteredLocalData) && filteredLocalData.length === 0 ? (
        <div className="alert alert-info text-center" role="alert">
          Nenhum dado encontrado para os critérios de filtro.
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-striped table-hover table-bordered vertical-align-middle text-center">
              <thead className="table-dark">
                <tr>
                  <th>Termo</th>
                  {/* Remova espaços ou quebras de linha extras entre as tags <th> */}
                  <th>Dt Emissão</th>
                  <th>AWB</th>
                  <th>Emissão</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Tomador</th>
                  <th>Destinatário</th>
                  <th>Voo</th>
                  <th>NFe</th>
                  <th>MDFe</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(currentItems) &&
                  currentItems.map((row, index) => (
                    <tr key={index}>
                      <td>{row.numero_termo || "N/A"}</td>
                      {/* Remova espaços ou quebras de linha extras entre as tags <td> */}
                      <td>{row.sefaz_data_emissao || "N/A"}</td>
                      <td
                        onClick={() => copyAwbLast8Digits(row.awb)}
                        style={{ cursor: "pointer" }}
                      >
                        <b>{row.awb || "N/A"}</b>
                      </td>
                      <td>{row.franchise_data_emissao || "N/A"}</td>
                      <td>{row.origem || "N/A"}</td>
                      <td>
                        <b>{row.destino || "N/A"}</b>
                      </td>
                      <td className="text-start">{row.tomador || "N/A"}</td>
                      <td className="text-start">
                        {row.destinatario || "N/A"}
                      </td>
                      <td>{row.numero_voo || "N/A"}</td>
                      <td>
                        {row.chave_nfe ? (
                          <TooltipWrapper title={row.chave_nfe}>
                            <FontAwesomeIcon
                              icon={faCopy}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(row.chave_nfe, "Chave NFe");
                              }}
                              style={{ cursor: "pointer", color: "#007bff" }}
                            />
                          </TooltipWrapper>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td>
                        {row.chave_mdfe ? (
                          <TooltipWrapper title={row.chave_mdfe}>
                            <FontAwesomeIcon
                              icon={faCopy}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(row.chave_mdfe, "Chave MDFe");
                              }}
                              style={{ cursor: "pointer", color: "#007bff" }}
                            />
                          </TooltipWrapper>
                        ) : (
                          "N/A"
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {renderPaginationButtons()}
        </>
      )}
    </div>
  );
}

export default forwardRef(CombinedData);
