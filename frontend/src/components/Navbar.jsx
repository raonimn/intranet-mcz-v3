// frontend/src/components/Navbar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';

function Navbar() {
    return (


                <nav className="navbar navbar-expand-lg bg-dark navbar-dark">
            <NavLink to='/' className='navbar-brand'>
                <img className='img-fluid img-thumbnail' src='/mcz.svg' alt='Logo' width={150} height={50} ></img>
            </NavLink>
            <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarSupportedContent">
                <ul className="navbar-nav me-auto mb-2 mb-lg-0"> 
                </ul>
            </div>
        </nav>
        /*
        <nav className="navbar navbar-expand-lg bg-dark navbar-dark">
            <NavLink to='/' className='navbar-brand'>
                <img className='img-fluid img-thumbnail' src='/mcz.svg' alt='Logo' width={150} height={50} ></img>
            </NavLink>
            <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarSupportedContent">
                <ul className="navbar-nav me-auto mb-2 mb-lg-0"> 
                    <li className="nav-item dropdown">
                        <a className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            Termos SEFAZ-AL
                        </a>
                        <ul className="dropdown-menu dropdown-menu-dark"> 
                            <li><NavLink to="/importar-termos" className={'dropdown-item'}>Importar Termos</NavLink></li>
                            <li><NavLink to="/importar-report" className={'dropdown-item'}>Importar Franchise Report</NavLink></li>
                            <li><NavLink to="/dados-combinados" className={'dropdown-item'}>Verificar termos/AWBs</NavLink></li>
                        </ul>
                    </li>
                </ul>
            </div>
        </nav>
    */
        );
}

export default Navbar;