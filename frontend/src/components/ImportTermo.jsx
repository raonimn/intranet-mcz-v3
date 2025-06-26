// frontend/src/components/ImportTermo.jsx (apenas as partes alteradas/adicionadas)

import React, { useState, useEffect } from 'react'; // <-- Importe useEffect
import axios from 'axios';

// Função auxiliar para formatar a data como dd/mm/yyyy
const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Mês é 0-indexed
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

function ImportTermo() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [numeroVoo, setNumeroVoo] = useState('');
    // Inicializa dataRegistro com a data atual no formato dd/mm/yyyy
    const [dataRegistro, setDataRegistro] = useState(formatDate(new Date()));
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    // useEffect para garantir que a data inicial seja sempre a atual ao montar o componente
    // Remova este useEffect se você não quiser que a data seja sempre atualizada ao re-renderizar
    // se o usuário já tiver digitado algo e não quiser perder.
    // Se a data atual for apenas um "valor inicial", pode manter.
    useEffect(() => {
        setDataRegistro(formatDate(new Date()));
    }, []);


    const handleFileChange = (event) => {
        setSelectedFile(event.target.files[0]);
        setMessage('');
    };

    const handleVooChange = (event) => {
        setNumeroVoo(event.target.value);
        setMessage('');
    };

    // Função para aplicar a máscara de data
    const handleDateChange = (event) => {
        let value = event.target.value;

        // Remove tudo que não for dígito
        value = value.replace(/\D/g, '');

        // Aplica a máscara dd/mm/yyyy
        if (value.length > 4) {
            value = value.replace(/^(\d{2})(\d{2})(\d{4}).*/, '$1/$2/$3');
        } else if (value.length > 2) {
            value = value.replace(/^(\d{2})(\d{2}).*/, '$1/$2');
        }

        setDataRegistro(value);
        setMessage('');
    };


    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!selectedFile) {
            setMessage('Por favor, selecione um arquivo PDF.');
            setIsSuccess(false);
            return;
        }
        if (!numeroVoo.trim()) {
            setMessage('Por favor, insira o número do voo.');
            setIsSuccess(false);
            return;
        }
        // Validação mais robusta para a data (opcional)
        const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!dataRegistro.trim() || !dateRegex.test(dataRegistro)) {
            setMessage('Por favor, insira uma data de registro válida no formato dd/mm/yyyy.');
            setIsSuccess(false);
            return;
        }


        const formData = new FormData();
        formData.append('pdf_file', selectedFile);
        formData.append('numeroVoo', numeroVoo);
        formData.append('dataRegistro', dataRegistro); // <-- ADICIONA A DATA AO FORMDATA

        try {
            const response = await axios.post('http://localhost:8080/api/upload-pdf', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setMessage(response.data.message);
            setIsSuccess(response.data.success);
            setSelectedFile(null);
            setNumeroVoo('');
            setDataRegistro(formatDate(new Date())); // Reseta para a data atual
            event.target.reset(); // Reseta o formulário, mas os estados controlados precisam ser resetados manualmente
        } catch (error) {
            console.error('Erro ao fazer upload do PDF:', error);
            setMessage(error.response?.data?.message || 'Erro ao processar o PDF. Verifique o console.');
            setIsSuccess(false);
        }
    };

    return (
        <div className="container">
            <h2>Insira o arquivo PDF enviado pela SEFAZ-AL, com os termos de apreensão/averiguação:</h2>
            <form onSubmit={handleSubmit}>
                {/* Campo para o Número do Voo */}
                <div style={{ marginBottom: '15px', width: '100%', textAlign: 'center' }}>
                    <label htmlFor="numeroVooInput" style={{ display: 'block', marginBottom: '5px' }}>Número do Voo:</label>
                    <input
                        type="text"
                        id="numeroVooInput"
                        value={numeroVoo}
                        onChange={handleVooChange}
                        placeholder="Ex: AD1234"
                        required
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '80%', maxWidth: '300px' }}
                    />
                </div>

                {/* Campo para a Data de Registro */}
                <div style={{ marginBottom: '15px', width: '100%', textAlign: 'center' }}>
                    <label htmlFor="dataRegistroInput" style={{ display: 'block', marginBottom: '5px' }}>Data de Registro:</label>
                    <input
                        type="text"
                        id="dataRegistroInput"
                        value={dataRegistro}
                        onChange={handleDateChange}
                        placeholder="dd/mm/yyyy"
                        maxLength="10" // Limita para o formato dd/mm/yyyy
                        required
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '80%', maxWidth: '300px' }}
                    />
                </div>

                {/* Restante do formulário para upload do PDF */}
                <label htmlFor="pdfInput">Escolher arquivo(s)</label>
                <input
                    type="file"
                    name="pdf_files"
                    id="pdfInput"
                    accept=".pdf"
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
                <button type="submit">Processar PDF(s)</button>

                {message && (
                    <p className={isSuccess ? 'message-success' : 'message-error'}>
                        {message}
                    </p>
                )}
            </form>
        </div>
    );
}

export default ImportTermo;