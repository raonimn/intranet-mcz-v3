// frontend/src/components/Navbar.jsx

import React from "react";
import { NavLink } from "react-router-dom";
import { AppBar, Toolbar, Typography, Box } from "@mui/material";

function Navbar() {

  const version = import.meta.env.VITE_INTRANET_VERSION;

  return (
    <AppBar position="static" color="primary">
      {" "}
      {/*sx={{ backgroundColor: '#343a40' }} */}
      <Toolbar>
        <NavLink to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {/* --- INÍCIO DA ALTERAÇÃO --- */}
            {/* 1. Criamos um Box que será a "moldura" com o fundo branco e a borda. */}
            <Box
              sx={{
                display: "flex", // Para centralizar a imagem dentro, caso ela seja menor
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff",
                padding: "4px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                marginRight: "10px",
                height: "60px", // A altura vai para o contêiner
                boxSizing: "border-box",
              }}
            >
              {/* 2. A imagem agora fica dentro do Box e ocupa o espaço disponível. */}
              <img
                src="/mcz.svg"
                alt="Logo"
                style={{
                  height: "100%", // A imagem ocupa 100% da altura do contêiner
                  width: "auto",
                }}
              />
            </Box>
            <Typography variant="h6" noWrap>
              Intranet
            </Typography>
          </Box>
        </NavLink>
        {/* Espaço expansivo para empurrar a versão para a direita */}
        <Box sx={{ flexGrow: 1 }} />
        {/* Versão do sistema no canto direito */}
        <Typography
          variant="caption"
          color="inherit"
          sx={{
            opacity: 0.7,
            fontSize: "0.75rem",
            marginRight: "10px",
          }}
        >
          v{version}
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
