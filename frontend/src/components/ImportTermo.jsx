// frontend/src/components/ImportTermo.jsx

import React, { useState, useEffect } from "react";
import axios from "axios";

const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

function ImportTermo() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [numeroVoo, setNumeroVoo] = useState("");
  const [dataRegistro, setDataRegistro] = useState(formatDate(new Date()));
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [additionalMessage, setAdditionalMessage] = useState("");

  useEffect(() => {
    setDataRegistro(formatDate(new Date()));
  }, []);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setMessage("");
  };

  const handleVooChange = (event) => {
    setNumeroVoo(event.target.value);
    setMessage("");
  };

  const handleDateChange = (event) => {
    let value = event.target.value;
    value = value.replace(/\D/g, "");
    if (value.length > 4) {
      value = value.replace(/^(\d{2})(\d{2})(\d{4}).*/, "$1/$2/$3");
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{2}).*/, "$1/$2");
    }
    setDataRegistro(value);
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setMessage("Por favor, selecione um arquivo PDF.");
      setIsSuccess(false);
      return;
    }
    if (!numeroVoo.trim()) {
      setMessage("Por favor, insira o número do voo.");
      setIsSuccess(false);
      return;
    }
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dataRegistro.trim() || !dateRegex.test(dataRegistro)) {
      setMessage(
        "Por favor, insira uma data de registro válida no formato dd/mm/yyyy."
      );
      setIsSuccess(false);
      return;
    }

    setIsLoading(true);
    setMessage("");
    setAdditionalMessage("");

    const formData = new FormData();
    formData.append("pdf_file", selectedFile);
    formData.append("numeroVoo", numeroVoo);
    formData.append("dataRegistro", dataRegistro);

    try {
      const backend_url = import.meta.env.VITE_BACKEND_URL;
      const response = await axios.post(
        `${backend_url}/api/upload-pdf`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setMessage(response.data.message);
      setIsSuccess(response.data.success);
      setAdditionalMessage(response.data.additionalInfo || "");
      setSelectedFile(null);
      // setNumeroVoo(''); // Comentei para manter o voo após o processamento, se desejar
      // setDataRegistro(formatDate(new Date())); // Comentei para manter a data após o processamento, se desejar
      event.target.reset(); // Reseta o input do arquivo
    } catch (error) {
      console.error("Erro ao fazer upload do PDF:", error);
      setMessage(
        error.response?.data?.message ||
          "Erro ao processar o PDF. Verifique o console."
      );
      setIsSuccess(false);
      setAdditionalMessage("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>
        Insira o arquivo PDF enviado pela SEFAZ-AL, com os termos de
        apreensão/averiguação:
      </h2>
      <form onSubmit={handleSubmit}>
        <div
          style={{ marginBottom: "15px", width: "100%", textAlign: "center" }}
        >
          <label
            htmlFor="numeroVooInput"
            style={{ display: "block", marginBottom: "5px" }}
          >
            Número do Voo:
          </label>
          <input
            type="text"
            id="numeroVooInput"
            value={numeroVoo}
            onChange={handleVooChange}
            placeholder="Ex: AD1234"
            required
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              width: "80%",
              maxWidth: "300px",
            }}
          />
        </div>

        <div
          style={{ marginBottom: "15px", width: "100%", textAlign: "center" }}
        >
          <label
            htmlFor="dataRegistroInput"
            style={{ display: "block", marginBottom: "5px" }}
          >
            Data de Registro:
          </label>
          <input
            type="text"
            id="dataRegistroInput"
            value={dataRegistro}
            onChange={handleDateChange}
            placeholder="dd/mm/yyyy"
            maxLength="10"
            required
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              width: "80%",
              maxWidth: "300px",
            }}
          />
        </div>

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
        <button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner"></span> Processando...
            </>
          ) : (
            "Processar PDF(s)"
          )}
        </button>

        {message && (
          <p className={isSuccess ? "message-success" : "message-error"}>
            {message}
            {isSuccess && additionalMessage && ` ${additionalMessage}`}
          </p>
        )}
      </form>
    </div>
  );
}

export default ImportTermo;
