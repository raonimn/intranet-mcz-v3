// frontend/src/components/CombinedData.jsx

import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

// Função auxiliar para formatar a data como DD/MM/YYYY
const formatDateToDDMMYYYY = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// Função para aplicar a máscara de data
const applyDateMask = (value) => {
    value = value.replace(/\D/g, '');
    if (value.length > 4) {
        value = value.replace(/^(\d{2})(\d{2})(\d{4}).*/, '$1/$2/$3');
    } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{2}).*/, '$1/$2');
    }
    return value;
};


function CombinedData() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterVoo, setFilterVoo] = useState('');
    const [filterData, setFilterData] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams();
            if (filterVoo.trim()) {
                queryParams.append('numeroVoo', filterVoo.trim());
            }
            if (filterData.trim()) {
                queryParams.append('dataRegistro', filterData.trim());
            }

            const response = await axios.get(`http://localhost:8080/api/combined-data-specific?${queryParams.toString()}`);
            setData(response.data);
        } catch (err) {
            setError('Erro ao buscar os dados: ' + (err.response?.data?.message || err.message));
            console.error('Erro ao buscar dados combinados:', err);
        } finally {
            setLoading(false);
        }
    }, [filterVoo, filterData]);

    // Dispara a busca quando o componente é montado ou filtros mudam
    useEffect(() => {
        fetchData();
    }, [fetchData]);


    const handleVooChange = (event) => {
        setFilterVoo(event.target.value);
    };

    const handleDataChange = (event) => {
        setFilterData(applyDateMask(event.target.value));
    };

    const handleFilterSubmit = (event) => {
        event.preventDefault();
        fetchData();
    };

    if (loading) {
        return <div className="container">Carregando dados...</div>;
    }

    if (error) {
        return <div className="container" style={{ color: 'red' }}>{error}</div>;
    }

    if (data.length === 0) {
        return <div className="container">Nenhum dado encontrado para os critérios de filtro.</div>;
    }

    return (
        <div className="container">
            <h2>Resultado dos Termos da SEFAZ Importados</h2>

            {/* Filtros */}
            <form onSubmit={handleFilterSubmit} style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <label htmlFor="filterVoo">Filtrar por Voo:</label>
                    <input
                        type="text"
                        id="filterVoo"
                        value={filterVoo}
                        onChange={handleVooChange}
                        placeholder="Número do Voo"
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <label htmlFor="filterData">Filtrar por Data:</label>
                    <input
                        type="text"
                        id="filterData"
                        value={filterData}
                        onChange={handleDataChange}
                        placeholder="dd/mm/yyyy"
                        maxLength="10"
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>
                <button type="submit" style={{ padding: '8px 15px', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' }}>
                    Filtrar
                </button>
            </form>

            <table>
                <thead>
                    <tr>
                        <th>Nº Termo</th>
                        <th>AWB</th>
                        <th>Origem</th>
                        <th>Destino</th>
                        <th>Tomador</th>
                        <th>Destinatário</th>
                        <th>Nº Voo</th>
                        <th>Dt Registro</th>
                        <th>Dt Emissão (Franchise)</th>
                        <th>NFe</th>
                        <th>CTE</th>
                        <th>MDFe</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr key={index}>
                            <td>{row.numero_termo || 'N/A'}</td>
                            <td>{row.awb || 'N/A'}</td>
                            <td>{row.origem || 'N/A'}</td>
                            <td>{row.destino || 'N/A'}</td>
                            <td>{row.tomador || 'N/A'}</td>
                            <td>{row.destinatario || 'N/A'}</td>
                            <td>{row.numero_voo || 'N/A'}</td>
                            <td>{row.data_registro || 'N/A'}</td>
                            <td>{row.franchise_data_emissao || 'N/A'}</td>
                            <td>{row.chave_nfe || 'N/A'}</td>
                            <td>{row.numero_cte || 'N/A'}</td>
                            <td>{row.chave_mdfe || 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default CombinedData;