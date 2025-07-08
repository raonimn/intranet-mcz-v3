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
import { Box, Fab, Tooltip } from "@mui/material";
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

  // Estado para controle da Sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Estado para os campos de filtro do formulário
  const [filters, setFilters] = useState({
    awb: "",
    termo: "",
    destino: "",
    voo: "",
    dataTermo: null, // O DatePicker do MUI trabalha bem com `null` e objetos dayjs
  });

  // Estado para os filtros que são efetivamente aplicados na busca
  const [activeFilters, setActiveFilters] = useState({});
  
  // Estado para o modal de status de termos
  const [showImportStatusTermosModal, setShowImportStatusTermosModal] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Manipulador genérico para atualizar o estado dos filtros
  const handleFilterChange = useCallback((e) => {
    // Tratamento especial para o DatePicker que não tem 'e.target'
    if (e.target && e.target.name) {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    } else {
        // Assume que é o DatePicker
        setFilters(prev => ({...prev, dataTermo: e}));
    }
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ awb: "", termo: "", destino: "", voo: "", dataTermo: null });
    setActiveFilters({});
    showToast("Filtros Limpos", "A tabela foi recarregada com todos os dados.", "info");
  }, [showToast]);

  const handleFilterSubmit = useCallback((e) => {
    e.preventDefault();
    const formattedFilters = {
      ...filters,
      dataTermo: formatDateToDDMMYYYY(filters.dataTermo),
    };
    setActiveFilters(formattedFilters);
    setIsSidebarOpen(false); // Fecha a sidebar após aplicar
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
  
  return (
    <>
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
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        onFilterSubmit={handleFilterSubmit}
        onImportClick={handleImportClick}
      />

      <Box component="main" sx={{ p: 2, ml: { xs: 0, md: isSidebarOpen ? '280px' : 0 }, transition: 'margin-left 0.3s' }}>
        <CombinedData 
            filters={activeFilters}
            ref={combinedDataRef}
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