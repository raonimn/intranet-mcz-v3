// frontend/src/components/NotificationToast.jsx

import React from 'react';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';

/**
 * Um componente de Toast reutilizável e com posicionamento fixo na tela.
 * @param {object} props
 * @param {boolean} props.show - Controla se o Toast está visível.
 * @param {string} props.title - O título exibido no cabeçalho do Toast.
 * @param {string} props.message - A mensagem principal no corpo do Toast.
 * @param {string} props.type - O tipo do Toast ('success', 'danger', 'info', etc.), que define a cor de fundo.
 * @param {function} props.onClose - A função a ser chamada quando o Toast for fechado.
 */
function NotificationToast({ show, title, message, type, onClose }) {
  return (
    <ToastContainer
      position="top-end"
      className="p-3"
      style={{
        position: 'fixed', // A correção principal: posicionamento fixo na tela
        zIndex: 2000,      // Garante que fique acima da maioria dos elementos
      }}
    >
      <Toast
        onClose={onClose}
        show={show}
        delay={5000}
        autohide
        bg={type}
      >
        <Toast.Header>
          <strong className="me-auto">{title}</strong>
          <small>Agora</small>
        </Toast.Header>
        <Toast.Body
          className={type === 'light' || type === 'warning' ? 'text-dark' : 'text-white'}
        >
          {message}
        </Toast.Body>
      </Toast>
    </ToastContainer>
  );
}

export default NotificationToast;