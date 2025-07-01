// frontend/src/utils/logService.js
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Função para tentar obter o IP local (pode ser impreciso ou falhar em alguns navegadores/redes)
async function getLocalIp() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json'); // Exemplo de serviço externo para IP público
        return response.data.ip;
    } catch (error) {
        console.warn('Não foi possível obter o IP público:', error);
        return 'N/A';
    }
    // Para IP local, é mais complexo, exigiria WebRTC ou outras APIs não padrão.
    // O IP retornado aqui será o IP público ou o IP do gateway se estiver em rede local.
}

// Função para tentar obter o MAC Address (extremamente difícil/impossível em navegadores por segurança)
async function getMacAddress() {
    // Navegadores por padrão não expõem MAC Address por motivos de privacidade e segurança.
    // Retornar "N/A" ou uma mensagem explicativa é o comportamento esperado.
    return 'N/A (Não acessível pelo navegador)';
}

async function logActivity(action, details = {}, success = true) {
    const user_ip = await getLocalIp();
    const mac_address = await getMacAddress(); // Sempre será N/A para navegadores
    const user_agent = navigator.userAgent; // Informações do navegador e SO

    const logData = {
        action,
        user_ip,
        mac_address,
        user_agent,
        details: JSON.stringify(details), // Converter detalhes para string JSON
        success
    };

    try {
        await axios.post(`${BACKEND_URL}/api/log`, logData);
        console.log(`Log sent: ${action}`);
    } catch (error) {
        console.error(`Failed to send log for action "${action}":`, error);
    }
}

export default logActivity;