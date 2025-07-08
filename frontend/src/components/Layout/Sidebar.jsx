// frontend/src/components/Layout/Sidebar.jsx
import React from "react";
import { Dropdown } from "react-bootstrap"; // Importando APENAS o Dropdown do react-bootstrap

// --- INÍCIO DA CORREÇÃO ---
// Importando os componentes corretos da biblioteca MUI
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  TextField,
  Button,
} from "@mui/material";
// --- FIM DA CORREÇÃO ---

import { DatePicker } from "@mui/x-date-pickers/DatePicker";

// Icons
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import DescriptionIcon from "@mui/icons-material/Description";
import FlightIcon from "@mui/icons-material/Flight";
import ReplayIcon from "@mui/icons-material/Replay";
import FilterAltIcon from "@mui/icons-material/FilterAlt";

// O Sidebar agora recebe todo o estado e manipuladores como props
const Sidebar = ({
  isOpen,
  toggleSidebar,
  filters,
  onFilterChange,
  onDateChange, // <-- Nova prop
  onResetFilters,
  onFilterSubmit,
  onImportClick,
}) => {
  return (
    <Drawer
      anchor="left"
      open={isOpen}
      onClose={toggleSidebar}
      PaperProps={{
        sx: {
          width: 280,
          boxSizing: "border-box",
          backgroundColor: "#343a40",
          color: "#fff",
          paddingTop: "64px",
        },
      }}
    >
      <Box sx={{ p: 2, overflowY: 'auto' }}>
        <IconButton
          onClick={toggleSidebar}
          sx={{ position: "absolute", top: 8, right: 8, color: "#fff" }}
        >
          <CloseIcon />
        </IconButton>
        <List>
          {/* Menu de Ferramentas */}
          <ListItem disablePadding>
            <Dropdown className="w-100">
              <Dropdown.Toggle
                variant="secondary"
                id="dropdown-tools-mui"
                className="w-100 text-start"
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "#dee2e6" }}>
                  <SearchIcon />
                </ListItemIcon>
                <ListItemText primary="Ferramentas" />
              </Dropdown.Toggle>

              <Dropdown.Menu data-bs-theme="dark">
                <Dropdown.Item onClick={() => onImportClick("franchise")}>
                  <FileUploadIcon fontSize="small" className="me-2" /> Importar dados SK
                </Dropdown.Item>
                <Dropdown.Item onClick={() => onImportClick("termos")}>
                  <DescriptionIcon fontSize="small" className="me-2" /> Importar termos SEFAZ
                </Dropdown.Item>
                <Dropdown.Item onClick={() => onImportClick("status_termos")}>
                  <DescriptionIcon fontSize="small" className="me-2" /> Importar Status Termos
                </Dropdown.Item>
                <Dropdown.Item disabled>
                  <FlightIcon fontSize="small" className="me-2" /> Importar malha de voos
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </ListItem>

          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

          <ListItem>
            <ListItemText
              primary={
                <Box sx={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                  Filtros de Pesquisa
                </Box>
              }
            />
          </ListItem>

          {/* Formulário de Filtros */}
          <Box
            component="form"
            onSubmit={onFilterSubmit}
            sx={{ "& .MuiFormControl-root": { mb: 2 } }}
          >
            <TextField
              label="AWB" name="awb" value={filters.awb}
              onChange={onFilterChange}
              fullWidth size="small" variant="outlined" inputProps={{ maxLength: 8 }}
              sx={{ input: { color: "#fff" }, label: { color: "#ccc" }, ".MuiOutlinedInput-notchedOutline": { borderColor: "#555" } }}
            />
            <TextField
              label="Termo" name="termo" value={filters.termo}
              onChange={onFilterChange}
              fullWidth size="small" variant="outlined" inputProps={{ maxLength: 8 }}
              sx={{ input: { color: "#fff" }, label: { color: "#ccc" }, ".MuiOutlinedInput-notchedOutline": { borderColor: "#555" } }}
            />
            <TextField
              label="Destino" name="destino" value={filters.destino}
              onChange={onFilterChange}
              fullWidth size="small" variant="outlined" inputProps={{ maxLength: 6 }}
              sx={{ input: { color: "#fff" }, label: { color: "#ccc" }, ".MuiOutlinedInput-notchedOutline": { borderColor: "#555" } }}
            />
            <TextField
              label="Voo" name="voo" value={filters.voo}
              onChange={onFilterChange}
              fullWidth size="small" variant="outlined" inputProps={{ maxLength: 6 }}
              sx={{ input: { color: "#fff" }, label: { color: "#ccc" }, ".MuiOutlinedInput-notchedOutline": { borderColor: "#555" } }}
            />
            <DatePicker
              label="Data Inicial"
              value={filters.dataInicial}
              onChange={(date) => onDateChange(date, 'dataInicial')}
              format="DD/MM/YYYY"
              slotProps={{ textField: { fullWidth: true, size: "small", variant: "outlined" } }}
              sx={{
                "& .MuiInputBase-input, & .MuiInputLabel-root, & .MuiSvgIcon-root": { color: "#ccc" },
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#555" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#777" }
              }}
            />
            <DatePicker
              label="Data Final"
              value={filters.dataFinal}
              onChange={(date) => onDateChange(date, 'dataFinal')}
              format="DD/MM/YYYY"
              slotProps={{ textField: { fullWidth: true, size: "small", variant: "outlined" } }}
              sx={{
                "& .MuiInputBase-input, & .MuiInputLabel-root, & .MuiSvgIcon-root": { color: "#ccc" },
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#555" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#777" }
              }}
            />
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button
                variant="outlined" color="primary"
                startIcon={<ReplayIcon />} onClick={onResetFilters} fullWidth
              >
                Limpar
              </Button>
              <Button
                variant="contained" startIcon={<FilterAltIcon />}
                type="submit" fullWidth
              >
                Aplicar
              </Button>
            </Box>
          </Box>
        </List>
      </Box>
    </Drawer>
  );
};

export default Sidebar;