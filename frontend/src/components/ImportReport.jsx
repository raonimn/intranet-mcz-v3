// frontend/src/components/ImportReport.jsx

import React, { useState } from "react";
import axios from "axios";

function ImportReport() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [additionalMessage, setAdditionalMessage] = useState("");

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setMessage("Por favor, selecione um arquivo XLSX.");
      setIsSuccess(false);
      return;
    }

    setIsLoading(true);
    setMessage("");
    setAdditionalMessage("");

    const formData = new FormData();
    formData.append("xlsx_file", selectedFile);

    try {
      const backend_url = import.meta.env.VITE_BACKEND_URL;
      const response = await axios.post(
        `${backend_url}/api/upload-report`,
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
      event.target.reset();
    } catch (error) {
      console.error("Erro ao fazer upload do XLSX:", error);
      setMessage(
        error.response?.data?.message ||
          "Erro ao processar o XLSX. Verifique o console."
      );
      setIsSuccess(false);
      setAdditionalMessage("");
    } finally {
      setIsLoading(false);
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
        <button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner"></span> Processando...
            </>
          ) : (
            "Processar Relatório"
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

export default ImportReport;
