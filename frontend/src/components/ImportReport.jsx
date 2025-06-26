// frontend/src/components/ImportReport.jsx

import React, { useState } from 'react';
import axios from 'axios';

function ImportReport() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files[0]);
        setMessage(''); // Limpa a mensagem ao selecionar um novo arquivo
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!selectedFile) {
            setMessage('Por favor, selecione um arquivo XLSX.');
            setIsSuccess(false);
            return;
        }

        const formData = new FormData();
        formData.append('xlsx_file', selectedFile);

        try {
            // A URL do backend é http://localhost:8080
            const response = await axios.post('http://localhost:8080/api/upload-report', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setMessage(response.data.message);
            setIsSuccess(response.data.success);
            setSelectedFile(null); // Limpa o arquivo selecionado após o sucesso
            event.target.reset(); // Reseta o formulário
        } catch (error) {
            console.error('Erro ao fazer upload do XLSX:', error);
            setMessage(error.response?.data?.message || 'Erro ao processar o XLSX. Verifique o console.');
            setIsSuccess(false);
        }
    };

    return (
        <div className="container">
            <h2>Insira os arquivos do Franchise Report para importação:</h2>
            <form onSubmit={handleSubmit}>
                <label htmlFor="xlsxInput">Escolher arquivo XLSX</label>
                <input
                    type="file"
                    name="xlsx_file"
                    id="xlsxInput"
                    accept=".xlsx"
                    onChange={handleFileChange}
                    required
                />
                {selectedFile && (
                    <div id="fileListContainer">
                        <p id="fileListTitle">Arquivo selecionado:</p>
                        <div id="fileList">
                            <p>{selectedFile.name}</p>
                        </div>
                    </div>
                )}
                <button type="submit">Processar Relatório</button>

                {message && (
                    <p className={isSuccess ? 'message-success' : 'message-error'}>
                        {message}
                    </p>
                )}
            </form>
        </div>
    );
}

export default ImportReport;