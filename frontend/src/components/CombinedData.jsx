// frontend/src/components/CombinedData.jsx
import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';
import ImportActions from './ImportActions';

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

// TooltipWrapper (mantido como está, ele já usa os atributos data-bs-*)
const TooltipWrapper = ({ children, title }) => {
    return (
        <span data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={title} title={title}>
            {children}
        </span>
    );
};

// CombinedData agora recebe `props` e `ref`
function CombinedData({ filters, isSidebarOpen, onTermosImported }, ref) {
    const [data, setData] = useState([]);
    const [cardsLoading, setCardsLoading] = useState(true); // Novo estado para carregamento dos cards
    const [tableLoading, setTableLoading] = useState(false); // Novo estado para carregamento da tabela
    const [error, setError] = useState(null);

    const [awbsByDestination, setAwbsByDestination] = useState([]);
    const [missingDates, setMissingDates] = useState({});

    const [isProcessing, setIsProcessing] = useState(false); // Estado para o overlay de importação
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Estados para Paginação (Funcionalidade 6)
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(50); // 50 registros por página

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    const showAppToast = useCallback((title, message, type) => {
        setToast({ show: true, title, message, type });
    }, []);

    // A inicialização dos tooltips é feita automaticamente pelo Bootstrap com data-bs-*

    const fetchAwbsByDestination = useCallback(async () => {
        try {
            const response = await axios.get(
                `${BACKEND_URL}/api/awbs-by-destination`
            );
            setAwbsByDestination(response.data);
        } catch (err) {
            console.error("Erro ao buscar AWBs por destino:", err);
            showAppToast('Erro', 'Falha ao carregar AWBs por destino.', 'danger');
        }
    }, [BACKEND_URL, showAppToast]);

    const fetchMissingDates = useCallback(async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/api/missing-dates`);
            setMissingDates(response.data);
        } catch (err) {
            console.error("Erro ao buscar datas faltantes:", err);
            showAppToast('Erro', 'Falha ao carregar datas faltantes.', 'danger');
        }
    }, [BACKEND_URL, showAppToast]);

    const fetchData = useCallback(async () => {
        setTableLoading(true); // Ativa o spinner da tabela
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
            if (filters.destino && filters.destino.trim()) { // Agora é exato no backend
                queryParams.append("destino", filters.destino.trim());
            }

            const response = await axios.get(
                `${BACKEND_URL}/api/combined-data-specific?${queryParams.toString()}`
            );
            setData(response.data);
            setCurrentPage(1); // Resetar para a primeira página ao aplicar novos filtros
        } catch (err) {
            setError(
                "Erro ao buscar os dados: " +
                (err.response?.data?.message || err.message)
            );
            console.error("Erro ao buscar dados combinados:", err);
            showAppToast('Erro', `Falha ao carregar dados combinados: ${err.response?.data?.message || err.message}`, 'danger');
        } finally {
            setTableLoading(false); // Desativa o spinner da tabela
        }
    }, [filters, BACKEND_URL, showAppToast]);

    // handleProcessingChange agora lida com o overlay de importação e atualiza cards/tabela
    const handleProcessingChange = useCallback((processing, type, extractedData) => {
        setIsProcessing(processing); // Controla o overlay global
        if (!processing) { // Se o processamento finalizou
            // Recarregar TUDO (tabela e cards de sumário) apenas após uma importação
            fetchData(); // Atualiza a tabela com os filtros atuais
            fetchAwbsByDestination(); // Atualiza dados dos cards
            fetchMissingDates(); // Atualiza dados dos cards

            if (type === 'termos' && extractedData) {
                onTermosImported('extractedTerms', extractedData);
            }
        }
    }, [fetchData, fetchAwbsByDestination, fetchMissingDates, onTermosImported]);


    // useEffect para buscar dados da tabela apenas quando os filtros mudam
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // useEffect para buscar dados dos cards de sumário apenas na montagem inicial
    useEffect(() => {
        setCardsLoading(true); // Ativa o spinner dos cards na montagem
        Promise.all([
            fetchAwbsByDestination(),
            fetchMissingDates()
        ]).finally(() => {
            setCardsLoading(false); // Desativa o spinner dos cards
        });
    }, [fetchAwbsByDestination, fetchMissingDates]);


    const copyToClipboard = useCallback(async (text, type) => {
        try {
            await navigator.clipboard.writeText(text);
            showAppToast('Copiado!', `${type} copiado: ${text}`, 'info');
        } catch (err) {
            console.error("Erro ao copiar para a área de transferência:", err);
            showAppToast('Erro', 'Erro ao copiar. Por favor, tente novamente.', 'danger');
        }
    }, [showAppToast]);

    const copyAwbLast8Digits = useCallback((awb) => {
        if (awb && awb.length >= 8) {
            const last8Digits = awb.slice(-8);
            copyToClipboard(last8Digits, "AWB (8 últimos dígitos)");
        } else {
            showAppToast('Aviso', 'AWB muito curto para copiar 8 dígitos.', 'warning');
        }
    }, [copyToClipboard, showAppToast]);

    const formatNumber = (num) => new Intl.NumberFormat("pt-BR").format(num);

    const totalAwbsCalculated = awbsByDestination.reduce((sum, item) => sum + item.total_awbs, 0);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(data.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const renderPaginationButtons = () => {
        const pageNumbers = [];
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push(
                <li key={i} className={`page-item ${currentPage === i ? 'active' : ''}`}>
                    <button onClick={() => paginate(i)} className="page-link">
                        {i}
                    </button>
                </li>
            );
        }
        return (
            <ul className="pagination justify-content-center mt-4">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button onClick={() => paginate(currentPage - 1)} className="page-link">
                        Anterior
                    </button>
                </li>
                {pageNumbers}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button onClick={() => paginate(currentPage + 1)} className="page-link">
                        Próximo
                    </button>
                </li>
            </ul>
        );
    };

    const importActionsInternalRef = useRef(null);
    useImperativeHandle(ref, () => ({
        showFranchiseModal: () => importActionsInternalRef.current.showFranchiseModal(),
        showTermosModal: () => importActionsInternalRef.current.showTermosModal(),
    }));


    return (
        <div className={`container my-4 ${isSidebarOpen ? 'content-shifted' : ''}`}>
            {/* Overlay de carregamento para importações */}
            {isProcessing && (
                <div
                    className="overlay d-flex justify-content-center align-items-center"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1050,
                    }}
                >
                    <div className="spinner-border text-light" role="status" style={{ width: '3rem', height: '3rem' }}>
                        <span className="visually-hidden">Processando...</span>
                    </div>
                </div>
            )}

            <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1051 }}>
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
                    <Toast.Body className={toast.type === 'light' ? 'text-dark' : 'text-white'}>{toast.message}</Toast.Body>
                </Toast>
            </ToastContainer>


            <ImportActions
                onProcessingChange={handleProcessingChange}
                showToast={showAppToast}
                ref={importActionsInternalRef}
            />


            {/* Cards de sumário (Registros, Datas Faltantes e Malha de Voos) */}
            {/* Exibir spinner apenas se cardsLoading for true */}
            {cardsLoading ? (
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '150px' }}>
                    <div className="spinner-border text-secondary" role="status">
                        <span className="visually-hidden">Carregando dados de sumário...</span>
                    </div>
                </div>
            ) : (
                <div className="row mb-4 g-3">
                    <div className="col-md-4 mb-3 mb-md-0">
                        <div className="card h-100">
                            <div className="card-header">
                                <h5 className="mb-0">Registros no Banco (AWBs por Destino)</h5>
                            </div>
                            <div className="card-body" style={{ maxHeight: "300px", overflowY: "auto" }}>
                                <ul className="list-group list-group-flush">
                                    {awbsByDestination.length === 0 ? (
                                        <li className="list-group-item">
                                            Nenhum dado de destino encontrado.
                                        </li>
                                    ) : (
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
                                <strong>Total de AWBs: {formatNumber(totalAwbsCalculated)}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-4">
                        <div className="card h-100">
                            <div className="card-header">
                                <h5 className="mb-0">Datas Faltantes (últimos 30 dias)</h5>
                            </div>
                            <div className="card-body" style={{ maxHeight: "300px", overflowY: "auto" }}>
                                <ul className="list-group list-group-flush">
                                    {Object.keys(missingDates).length === 0 ? (
                                        <li className="list-group-item">
                                            Verificando datas faltantes...
                                        </li>
                                    ) : (
                                        Object.entries(missingDates).map(([destino, dates], idx) => (
                                            <li key={idx} className="list-group-item">
                                                <strong>{destino || "N/A"}:</strong>{" "}
                                                {dates.length > 0
                                                    ? dates.join(", ")
                                                    : "Todas as datas presentes."}
                                            </li>
                                        ))
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
                                <div className="spinner-grow text-info" role="status" style={{ width: '1.5rem', height: '1.5rem' }}>
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

            {tableLoading ? ( // Novo bloco de carregamento para a tabela
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Carregando dados da tabela...</span>
                    </div>
                </div>
            ) : data.length === 0 ? (
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
                                    <th>Dt Termo</th>
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
                                {currentItems.map((row, index) => (
                                    <tr key={index}>
                                        <td>{row.numero_termo || "N/A"}</td>
                                        <td>{row.data_registro || "N/A"}</td>
                                        <td onClick={() => copyAwbLast8Digits(row.awb)} style={{ cursor: "pointer" }}>
                                            <b>{row.awb || "N/A"}</b>
                                        </td>
                                        <td>{row.franchise_data_emissao || "N/A"}</td>
                                        <td>{row.origem || "N/A"}</td>
                                        <td>
                                            <b>{row.destino || "N/A"}</b>
                                        </td>
                                        <td className="text-start">{row.tomador || "N/A"}</td>
                                        <td className="text-start">{row.destinatario || "N/A"}</td>
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