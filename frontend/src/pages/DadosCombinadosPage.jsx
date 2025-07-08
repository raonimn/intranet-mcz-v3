// frontend/src/pages/DadosCombinadosPage.jsx
import React, { useState, useRef, useCallback } from "react";
import dayjs from "dayjs";

// Hooks e Componentes Reutilizáveis
import useToast from "../hooks/useToast";
import Navbar from "../components/Common/Navbar";
import Sidebar from "../components/Layout/Sidebar";
import CombinedData from "../components/DadosCombinados/CombinedData"; // O caminho será ajustado na próxima etapa
import ImportStatusTermosModal from "../components/Import/ImportStatusTermosModal";

// Componentes MUI
import { Box, Fab, Tooltip, CircularProgress, Typography } from "@mui/material"; // <-- ADICIONE AQUI
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";

// Função para formatar a data que será enviada na query da API
const formatDateToDDMMYYYY = (date) => {
  if (!date || !dayjs(date).isValid()) return "";
  return dayjs(date).format("DD/MM/YYYY");
};

function DadosCombinadosPage() {
  const { showToast } = useToast();
  const combinedDataRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false); // <-- ADICIONE ESTA LINHA


  // Estado para controle da Sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Estado para os campos de filtro do formulário
  const [filters, setFilters] = useState({
    awb: "",
    termo: "",
    destino: "",
    voo: "",
    dataInicial: null, // Alterado de dataTermo
    dataFinal: null,   // Novo campo
  });

  // Estado para os filtros que são efetivamente aplicados na busca
  const [activeFilters, setActiveFilters] = useState({});

  // Estado para o modal de status de termos
  const [showImportStatusTermosModal, setShowImportStatusTermosModal] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // --- 2. NOVO MANIPULADOR PARA AS DATAS ---
  const handleDateChange = useCallback((date, fieldName) => {
    setFilters(prev => ({ ...prev, [fieldName]: date }));
  }, []);

  // Manipulador genérico para atualizar o estado dos filtros
  const handleFilterChange = useCallback((e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ awb: "", termo: "", destino: "", voo: "", dataInicial: null, dataFinal: null });
    setActiveFilters({});
    showToast("Filtros Limpos", "A tabela foi recarregada com os dados mais recentes.", "info");
  }, [showToast]);

  const handleFilterSubmit = useCallback((e) => {
    e.preventDefault();
    const formattedFilters = {
      awb: filters.awb,
      termo: filters.termo,
      destino: filters.destino,
      voo: filters.voo,
      dataInicial: formatDateToDDMMYYYY(filters.dataInicial),
      dataFinal: formatDateToDDMMYYYY(filters.dataFinal),
    };
    setActiveFilters(formattedFilters);
    setIsSidebarOpen(false);
    showToast("Filtros Aplicados", "A tabela foi atualizada.", "success");
  }, [filters, showToast]);

  const handleImportClick = useCallback((importType) => {
    if (combinedDataRef.current) {
      if (importType === 'franchise') {
        combinedDataRef.current.showFranchiseModal();
      } else if (importType === 'termos') {
        combinedDataRef.current.showTermosModal();
      } else if (importType === 'status_termos') {
        setShowImportStatusTermosModal(true);
      }
    }
    setIsSidebarOpen(false);
  }, []);

  const handleImportSuccess = () => {
    // Função para recarregar os dados da tabela após uma importação bem-sucedida
    if (combinedDataRef.current?.fetchData) {
      combinedDataRef.current.fetchData();
    }
    setShowImportStatusTermosModal(false);
  };

  const handleProcessing = (status) => setIsProcessing(status); // <-- ADICIONE ESTA FUNÇÃO


  return (
    <>
      {isProcessing && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 2001, // Um z-index alto para ficar sobre tudo
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            color: 'white'
          }}
        >
          <CircularProgress color="inherit" size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Processando Importação...
          </Typography>
        </Box>
      )}
      <Navbar />

      <Tooltip title={isSidebarOpen ? "Fechar Menu" : "Abrir Menu de Filtros e Ferramentas"} placement="right">
        <Fab
          color="primary"
          onClick={toggleSidebar}
          sx={{ position: 'fixed', top: '50%', left: isSidebarOpen ? '260px' : '20px', transform: 'translateY(-50%)', zIndex: 1200, transition: 'left 0.3s ease-in-out', display: { xs: 'none', md: 'flex' } }}
        >
          {isSidebarOpen ? <CloseIcon /> : <MenuIcon />}
        </Fab>
      </Tooltip>

      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        filters={filters}
        onFilterChange={handleFilterChange} // Para os campos de texto
        onDateChange={handleDateChange}     // Novo handler para as datas
        onResetFilters={handleResetFilters}
        onFilterSubmit={handleFilterSubmit}
        onImportClick={handleImportClick}
      />

      <Box component="main" sx={{ p: 2, ml: { xs: 0, md: isSidebarOpen ? '280px' : 0 }, transition: 'margin-left 0.3s' }}>
        <CombinedData
          filters={activeFilters}
          ref={combinedDataRef}
          onProcessing={handleProcessing} // <-- ADICIONE ESTA PROP
        />
      </Box>

      <ImportStatusTermosModal
        show={showImportStatusTermosModal}
        handleClose={() => setShowImportStatusTermosModal(false)}
        onImportSuccess={handleImportSuccess}
      />
    </>
  );
}

export default DadosCombinadosPage;