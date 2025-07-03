// frontend/src/components/Navbar.jsx

import React from "react";
import { NavLink } from "react-router-dom";
import { AppBar, Toolbar, Typography, Box } from "@mui/material";

function Navbar() {
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
                height: "50px", // A altura vai para o contêiner
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
          </Box>
        </NavLink>
        <Box sx={{ flexGrow: 1 }} />
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
