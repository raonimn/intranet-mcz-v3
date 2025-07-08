// services/rastreamentoAWB.js
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

/**
 * Consulta múltiplos AWBs na Azul Cargo usando um navegador real (Puppeteer).
 *
 * @param {...string} awbs - Lista de até 20 AWBs.
 * @returns {Promise<object>}
 */
const consultarAWBs = async (...awbs) => {
    if (awbs.length === 0) throw new Error("Nenhum AWB fornecido.");
    if (awbs.length > 20) throw new Error("A função aceita no máximo 20 AWBs por consulta.");

    const awbString = awbs.join(',');
    const url = `https://www.azulcargoexpress.com.br/Rastreio/Rastreio/Rastrear?awb=${awbString}`;

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new', // 'true' em produção
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 45000,
        });

        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);
        const resultado = {};
        const blocosRodape = $('.rodape');

        blocosRodape.each((i, el) => {
            const awb = awbs[i];
            const tipoEntrega = $(el).find('.grupo:contains("Tipo de entrega") .dados').text().trim();
            const volumesStr = $(el).find('.grupo:contains("Volume") .dados').text().trim();
            const pesoStr = $(el).find('.grupo:contains("Peso") .dados').text().trim();
            const status = $(el).find('.grupoUltimoStatus .dados').text().trim();

            const volumes = parseInt(volumesStr, 10);
            const peso = parseFloat(pesoStr.replace(',', '.'));

            resultado[awb] = {
                Tipo_entrega: tipoEntrega || 'Não informado',
                Volumes: isNaN(volumes) ? 0 : volumes,
                Peso: isNaN(peso) ? 0.0 : peso,
                Ultimo_Status: status || 'Não informado'
            };
        });

        awbs.forEach(awb => {
            if (!resultado[awb]) {
                resultado[awb] = {
                    error: 'AWB não encontrado no HTML.'
                };
            }
        });

        return resultado;
    } catch (err) {
        console.error("❌ Erro com Puppeteer:", err.message);
        throw new Error("Não foi possível acessar o site da Azul Cargo.");
    } finally {
        if (browser) await browser.close();
    }
};

module.exports = { consultarAWBs };
