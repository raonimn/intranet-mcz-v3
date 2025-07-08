const { consultarAWBs } = require('./services/rastreamentoAWB');

(async () => {
    try {
        console.log("Consultando AWBs...");
        const resultado = await consultarAWBs('65714062', '65714180', '65713841');
        console.log("Resultado:");
        console.log(JSON.stringify(resultado, null, 2));
    } catch (err) {
        console.error("Erro:", err.message);
    }
})();
