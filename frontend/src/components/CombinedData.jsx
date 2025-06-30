// frontend/src/components/CombinedData.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
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

// TooltipWrapper simplificado para usar atributos Bootstrap diretamente
const TooltipWrapper = ({ children, title }) => {
    // Usamos data-bs-title para que o Bootstrap inicialize o tooltip automaticamente
    // e title para o fallback em navegadores que não suportam ou JS desabilitado.
    return (
        <span data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={title} title={title}>
            {children}
        </span>
    );
};


function CombinedData() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tempFilterVoo, setTempFilterVoo] = useState("");
    const [tempFilterData, setTempFilterData] = useState("");
    const [activeFilterVoo, setActiveFilterVoo] = useState("");
    const [activeFilterData, setActiveFilterData] = useState("");

    const [awbsByDestination, setAwbsByDestination] = useState([]);
    const [missingDates, setMissingDates] = useState({});
    // Removido: const [totalAwbs, setTotalAwbs] = useState(0); // Este estado será calculado agora

    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    const showAppToast = useCallback((title, message, type) => {
        setToast({ show: true, title, message, type });
    }, []);

    // Função para inicializar todos os tooltips no DOM
    const initializeTooltips = useCallback(() => {
        // Dispose de tooltips existentes para evitar duplicidade
        const existingTooltips = document.querySelectorAll('.tooltip');
        existingTooltips.forEach(tooltip => tooltip.remove());

        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(tooltipTriggerEl => new window.bootstrap.Tooltip(tooltipTriggerEl));
    }, []);

    // TODAS AS FUNÇÕES DE BUSCA DECLARADAS PRIMEIRO
    // E COM SUAS DEPENDÊNCIAS EXPLÍCITAS

    const fetchAwbsByDestination = useCallback(async () => {
        try {
            const response = await axios.get(
                `${BACKEND_URL}/api/awbs-by-destination`
            );
            setAwbsByDestination(response.data);
            // Calculando o total aqui e definindo diretamente no componente
            // const calculatedTotal = response.data.reduce((sum, item) => sum + item.total_awbs, 0);
            // setTotalAwbs(calculatedTotal); // Removido, será calculado no JSX ou em uma variável
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

    // Removida a função fetchTotalAwbs


    // fetchData agora pode chamar as outras funções sem problema de inicialização
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams();
            if (activeFilterVoo.trim()) {
                queryParams.append("numeroVoo", activeFilterVoo.trim());
            }
            if (activeFilterData.trim()) {
                queryParams.append("dataRegistro", activeFilterData.trim());
            }

            const response = await axios.get(
                `${BACKEND_URL}/api/combined-data-specific?${queryParams.toString()}`
            );
            setData(response.data);
        } catch (err) {
            setError(
                "Erro ao buscar os dados: " +
                (err.response?.data?.message || err.message)
            );
            console.error("Erro ao buscar dados combinados:", err);
            showAppToast('Erro', `Falha ao carregar dados combinados: ${err.response?.data?.message || err.message}`, 'danger');
        } finally {
            setLoading(false);
            initializeTooltips(); // Inicializa tooltips após os dados serem carregados/atualizados
        }
    }, [activeFilterVoo, activeFilterData, BACKEND_URL, showAppToast, initializeTooltips]);


    const handleProcessingChange = useCallback((processing) => {
        setIsProcessing(processing);
        if (!processing) {
            fetchData(); // Recarrega dados da tabela principal
            fetchAwbsByDestination(); // Recarrega dados do card de AWB por destino
            fetchMissingDates(); // Recarrega dados do card de datas faltantes
            // Removida a chamada a fetchTotalAwbs aqui
        }
    }, [fetchData, fetchAwbsByDestination, fetchMissingDates]);


    // useEffect que chama todas as funções de busca
    useEffect(() => {
        fetchData();
        fetchAwbsByDestination();
        fetchMissingDates();
        // Removida a chamada a fetchTotalAwbs aqui
        initializeTooltips(); // Inicializa tooltips na montagem do componente
    }, [fetchData, fetchAwbsByDestination, fetchMissingDates, initializeTooltips]);


    const handleTempVooChange = (event) => {
        setTempFilterVoo(event.target.value);
    };

    const handleTempDataChange = (event) => {
        setTempFilterData(applyDateMask(event.target.value));
    };

    const handleFilterSubmit = (event) => {
        event.preventDefault();
        setActiveFilterVoo(tempFilterVoo);
        setActiveFilterData(tempFilterData);
    };

    // Função de cópia genérica, melhorada para robustez
    const copyToClipboard = useCallback(async (text, type) => {
        try {
            await navigator.clipboard.writeText(text);
            showAppToast('Copiado!', `${type} copiado: ${text}`, 'info');
        } catch (err) {
            console.error("Erro ao copiar para a área de transferência:", err);
            showAppToast('Erro', 'Erro ao copiar. Por favor, tente novamente.', 'danger');
        }
    }, [showAppToast]);

    // Nova função para copiar os últimos 8 dígitos do AWB
    const copyAwbLast8Digits = useCallback((awb) => {
        if (awb && awb.length >= 8) {
            const last8Digits = awb.slice(-8);
            copyToClipboard(last8Digits, "AWB (8 últimos dígitos)");
        } else {
            showAppToast('Aviso', 'AWB muito curto para copiar 8 dígitos.', 'warning');
        }
    }, [copyToClipboard, showAppToast]);

    const formatNumber = (num) => new Intl.NumberFormat("pt-BR").format(num);

    // Calcular o total de AWBs diretamente a partir de awbsByDestination
    const totalAwbsCalculated = awbsByDestination.reduce((sum, item) => sum + item.total_awbs, 0);

    return (
        <div className="container my-4">
            {/* Overlay de carregamento */}
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

            {/* Toast Container */}
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


            {/* Componente para as ações de importação */}
            <ImportActions onProcessingChange={handleProcessingChange} showToast={showAppToast} />

            {/* Cards de sumário (Registros, Datas Faltantes e Malha de Voos) */}
            {loading ? (
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '150px' }}>
                    <div className="spinner-border text-secondary" role="status">
                        <span className="visually-hidden">Carregando dados de sumário...</span>
                    </div>
                </div>
            ) : (
                <div className="row mb-4 g-3">
                    <div className="col-md-4 mb-3 mb-md-0"> {/* Ajustado para col-md-4 para 3 colunas */}
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
                            {/* Nova linha de total no footer do card */}
                            <div className="card-footer text-end">
                                <strong>Total de AWBs: {formatNumber(totalAwbsCalculated)}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-4"> {/* Ajustado para col-md-4 para 3 colunas */}
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

                    {/* NOVO CARD: Malha de Voos (placeholder) - Funcionalidade 5 */}
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
                                {/* Opcional: Um spinner ou ícone indicando que está em construção */}
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

            <div className="card mb-4">
                <div className="card-header text-center">
                    <h5 className="mb-0">Filtros de Pesquisa</h5>
                </div>
                <div className="card-body">
                    <form onSubmit={handleFilterSubmit}>
                        <div className="d-flex flex-wrap align-items-center justify-content-center gap-3">
                            <label htmlFor="filterVoo" className="form-label mb-0 me-2">Voo:</label>
                            <input
                                type="text"
                                className="form-control flex-grow-1"
                                id="filterVoo"
                                value={tempFilterVoo}
                                onChange={handleTempVooChange}
                                placeholder="Ex: AD1234"
                                style={{ maxWidth: '180px' }}
                            />

                            <label htmlFor="filterData" className="form-label mb-0 me-2">Data do voo:</label>
                            <input
                                type="text"
                                className="form-control flex-grow-1"
                                id="filterData"
                                value={tempFilterData}
                                onChange={handleTempDataChange}
                                placeholder="dd/mm/yyyy"
                                maxLength="10"
                                style={{ maxWidth: '180px' }}
                            />

                            <button type="submit" className="btn btn-primary">
                                Filtrar
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {data.length === 0 ? (
                <div className="alert alert-info text-center" role="alert">
                    Nenhum dado encontrado para os critérios de filtro.
                </div>
            ) : (
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
                                {/* <th>CTE</th> */}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, index) => (
                                <tr key={index}>
                                    <td>{row.numero_termo || "N/A"}</td>
                                    <td>{row.data_registro || "N/A"}</td>
                                    <td onClick={() => copyAwbLast8Digits(row.awb)} style={{ cursor: "pointer" }}> {/* Funcionalidade 3 */}
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
                                            <TooltipWrapper title={row.chave_nfe}> {/* Funcionalidade 2 */}
                                                <FontAwesomeIcon
                                                    icon={faCopy}
                                                    onClick={(e) => { // Previne propagação para não acionar o click da TD
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
                                            <TooltipWrapper title={row.chave_mdfe}> {/* Funcionalidade 2 */}
                                                <FontAwesomeIcon
                                                    icon={faCopy}
                                                    onClick={(e) => { // Previne propagação para não acionar o click da TD
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
                                    {/* <td>{row.numero_cte || 'N/A'}</td> */}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default CombinedData;