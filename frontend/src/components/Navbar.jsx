// frontend/src/components/Navbar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import {
    AppBar,
    Toolbar,
    Typography,
    Box,
} from '@mui/material';

function Navbar() {
  return (
    <AppBar position="static" color="primary"> {/* Usa a cor primary padrão do MUI */}
      <Toolbar>
        <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/mcz.svg"
              alt="Logo"
              style={{ height: '50px', width: 'auto', marginRight: '10px' }}
            />
            <Typography variant="h6" component="div">
              Intranet MCZ
            </Typography>
          </Box>
        </NavLink>
        <Box sx={{ flexGrow: 1 }} />
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;