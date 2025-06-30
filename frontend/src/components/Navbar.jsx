// frontend/src/components/Navbar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
// Remover importações de Button, FontAwesomeIcon, faBars, se não forem mais usados na Navbar
// import { Button } from 'react-bootstrap';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faBars } from '@fortawesome/free-solid-svg-icons';

function Navbar() { // Não recebe mais toggleSidebar
  return (
    <nav className="navbar navbar-expand-lg bg-dark navbar-dark">
      <div className="container-fluid">
        {/* REMOVIDO: Botão do sidebar na Navbar */}
        {/* <Button variant="outline-light" onClick={toggleSidebar} className="me-2 d-lg-none">
          <FontAwesomeIcon icon={faBars} />
        </Button> */}
        <NavLink to="/" className="navbar-brand">
          <img
            className="img-fluid img-thumbnail"
            src="/mcz.svg"
            alt="Logo"
            width={150}
            height={50}
          ></img>
        </NavLink>
        {/* REMOVIDO: Botão do sidebar na Navbar */}
        {/* <Button variant="outline-light" onClick={toggleSidebar} className="ms-auto d-none d-lg-block">
            <FontAwesomeIcon icon={faBars} />
        </Button> */}
        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0"></ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;