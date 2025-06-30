// frontend/src/components/CombinedData.jsx


import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';
import ImportActions from './ImportActions';

const applyDateMask = (value) => {
    value = value.replace(/\D/g, "");
    if (value.length > 4) {
        value = value.replace(/^(\d{2})(\d{2})(\d{4}).*/, "$1/$2/$3");
    } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{2}).*/, "$1/$2");
    }
    return value;
};

const TooltipWrapper = ({ children, title }) => {
    const tooltipRef = useRef(null);

    useEffect(() => {
        let tooltipInstance = null;
        if (tooltipRef.current && window.bootstrap && window.bootstrap.Tooltip) {
            tooltipInstance = new window.bootstrap.Tooltip(tooltipRef.current, {
                title: title,
                placement: "top",
                trigger: "hover",
                container: "body",
            });
        }
        return () => {
            if (tooltipInstance) {
                tooltipInstance.dispose();
            }
        };
    }, [title]);

    return <span ref={tooltipRef}>{children}</span>;
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

    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    const showAppToast = useCallback((title, message, type) => {
        setToast({ show: true, title, message, type });
    }, []);

    // TODAS AS FUNÇÕES DE BUSCA DECLARADAS PRIMEIRO
    // E COM SUAS DEPENDÊNCIAS EXPLÍCITAS

    const fetchAwbsByDestination = useCallback(async () => {
        try {
            const response = await axios.get(
                `${BACKEND_URL}/api/awbs-by-destination`
            );
            setAwbsByDestination(response.data);
        } catch (err) {
            console.error("Erro ao buscar AWBs por destino:", err);
        }
    }, [BACKEND_URL]);

    const fetchMissingDates = useCallback(async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/api/missing-dates`);
            setMissingDates(response.data);
        } catch (err) {
            console.error("Erro ao buscar datas faltantes:", err);
        }
    }, [BACKEND_URL]);

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
        } finally {
            setLoading(false);
        }
    }, [activeFilterVoo, activeFilterData, BACKEND_URL]);


    const handleProcessingChange = useCallback((processing) => {
        setIsProcessing(processing);
        if (!processing) {
            fetchData(); // Recarrega dados da tabela principal
            fetchAwbsByDestination(); // Recarrega dados do card de AWB por destino
            fetchMissingDates(); // Recarrega dados do card de datas faltantes
        }
    }, [fetchData, fetchAwbsByDestination, fetchMissingDates]);


    // useEffect que chama todas as funções de busca
    useEffect(() => {
        fetchData();
        fetchAwbsByDestination();
        fetchMissingDates();
    }, [fetchData, fetchAwbsByDestination, fetchMissingDates]); // Inclui todas as funções de busca como dependências


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

    const copyToClipboard = (text, type) => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                showAppToast('Copiado!', `${type} copiado: ${text}`, 'info');
            })
            .catch((err) => {
                console.error("Erro ao copiar para a área de transferência:", err);
                showAppToast('Erro', 'Erro ao copiar. Por favor, tente novamente.', 'danger');
            });
    };

    const formatNumber = (num) => new Intl.NumberFormat("pt-BR").format(num);

    // ... (restante do JSX do componente) ...
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

            {/* Cards de sumário (Registros e Datas Faltantes) */}
            {loading ? (
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '150px' }}>
                    <div className="spinner-border text-secondary" role="status">
                        <span className="visually-hidden">Carregando dados de sumário...</span>
                    </div>
                </div>
            ) : (
                <div className="row mb-4 g-3">
                    <div className="col-md-6 mb-3 mb-md-0">
                        <div className="card h-100">
                            <div className="card-header">
                                <h5 className="mb-0">Registros no Banco (AWBs por Destino)</h5>
                            </div>
                            <div className="card-body" style={{ maxHeight: "300px", overflowY: "auto" }}>
                                <ul className="list-group list-group-flush">
                                    <b>
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
                                    </b>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-6">
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
                                    <td>
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
                                                    onClick={() =>
                                                        copyToClipboard(row.chave_nfe, "Chave NFe")
                                                    }
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
                                                    onClick={() =>
                                                        copyToClipboard(row.chave_mdfe, "Chave MDFe")
                                                    }
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