// frontend/src/components/CombinedData.jsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';

function CombinedData() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('http://localhost:8080/api/combined-data-specific');
                setData(response.data);
            } catch (err) {
                setError('Erro ao buscar os dados: ' + (err.response?.data?.message || err.message));
                console.error('Erro ao buscar dados combinados:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return <div className="container">Carregando dados...</div>;
    }

    if (error) {
        return <div className="container" style={{ color: 'red' }}>{error}</div>;
    }

    if (data.length === 0) {
        return <div className="container">Nenhum dado encontrado para os termos inseridos ou no relatório de franquia.</div>;
    }

    return (
        <div className="container">
            <h2>Resultado dos Termos da SEFAZ Importados</h2>
            <table>
                <thead>
                    <tr>
                        <th>Número do Termo</th>
                        <th>AWB</th>
                        <th>Origem</th>
                        <th>Destino</th>
                        <th>Tomador</th>
                        <th>Destinatário</th>
                        <th>Número do Voo</th> {/* <-- NOVA COLUNA */}
                        <th>Data Registro</th> {/* <-- NOVA COLUNA */}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr key={index}>
                            <td>{row.numero_termo}</td>
                            <td>{row.awb}</td>
                            <td>{row.origem}</td>
                            <td>{row.destino}</td>
                            <td>{row.tomador}</td>
                            <td>{row.destinatario}</td>
                            <td>{row.numero_voo || 'N/A'}</td> {/* <-- EXIBE O DADO OU N/A */}
                            <td>{row.data_registro || 'N/A'}</td> {/* <-- EXIBE O DADO OU N/A */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default CombinedData;