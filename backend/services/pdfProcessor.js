// backend/services/pdfProcessor.js

const pdfParse = require('pdf-parse');
const {
    // createTermosInseridosTable, <-- REMOVIDO
    // clearTermosInseridosTable, <-- REMOVIDO
    // insertNumeroTermo,         <-- REMOVIDO
    insertSefazReportData, // Continuamos usando esta
    createSefazReportTable, // Usado na inicialização, mas pode ser removido daqui se não for mais chamado
} = require('../database');

const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';

const debugLog = (...args) => { if (LOG_DEBUG) { console.log('[DEBUG-PDF-PROCESSOR]', ...args); } };
const debugWarn = (...args) => { if (LOG_DEBUG) { console.warn('[DEBUG-PDF-PROCESSOR]', ...args); } };
const debugError = (...args) => { console.error('[ERROR-PDF-PROCESSOR]', ...args); };

async function processPdfAndSaveData(pdfBuffer, numeroVoo, dataRegistro) {
    try {
        debugLog('--- Início de processPdfAndSaveData ---');
        debugLog('Processando PDF para número de voo:', numeroVoo, 'e data de registro:', dataRegistro);

        const data = await pdfParse(pdfBuffer);
        const pdfText = data.text;
        debugLog('Texto extraído do PDF (primeiros 500 caracteres):\n', pdfText.substring(0, 500) + '...');
        debugLog('Tamanho total do texto extraído:', pdfText.length);

        const extractedData = extractDataFromPdfText(pdfText);
        debugLog('Dados extraídos de extractDataFromPdfText:', extractedData);

        if (extractedData.length === 0) {
            debugWarn('Nenhum dado válido foi extraído do PDF. Nenhuma inserção será feita.');
            return { success: true, insertedCount: 0, duplicateCount: 0, totalProcessed: 0, message: 'Nenhum dado válido foi extraído do PDF.' };
        }

        // --- REMOVIDAS AS CHAMADAS A termos_inseridos ---
        // debugLog('Criando/limpando tabela termos_inseridos...');
        // await createTermosInseridosTable();
        // await clearTermosInseridosTable();
        // debugLog('Tabela termos_inseridos pronta.');
        // --- FIM DA REMOÇÃO ---

        debugLog('Iniciando inserção de dados principais em sefaz_report...');
        // insertSefazReportData agora retorna um objeto com counts
        const { insertedCount, duplicateCount, totalProcessed } = await insertSefazReportData(extractedData, numeroVoo, dataRegistro);
        debugLog('Inserção de dados principais em sefaz_report concluída.');

        // --- REMOVIDA A INSERÇÃO DE NÚMEROS DE TERMO AQUI ---
        // debugLog('Iniciando inserção de números de termo...');
        // for (const dado of extractedData) {
        //     if (dado && dado[2]) {
        //         debugLog('Inserindo número de termo:', dado[2]);
        //         await insertNumeroTermo(dado[2]);
        //     }
        // }
        // debugLog('Inserção de números de termo concluída.');
        // --- FIM DA REMOÇÃO ---

        debugLog("Processamento do PDF e dados salvos com sucesso no SQLite.");
        return { success: true, insertedCount, duplicateCount, totalProcessed, message: 'PDF processado com sucesso.' };

    } catch (error) {
        debugError("Erro durante o processamento do PDF e salvamento no SQLite:", error);
        return { success: false, insertedCount: 0, duplicateCount: 0, totalProcessed: 0, message: error.message || 'Erro desconhecido durante o processamento do PDF.' };
    } finally {
        debugLog('--- Fim de processPdfAndSaveData ---');
    }
}

function extractDataOrNone(text, pattern) {
    const match = text.match(pattern);
    return match ? match[1] : null;
}

function extractDataFromPdfText(pdf_text) {
    let tipo_pdf;
    const dados_termos_averguacao = [];
    let numero_termo_anterior = '';

    const match_relatorio = pdf_text.includes('Relatório de Termos de Averiguação dos MDF-es');
    const match_demo = pdf_text.includes('DEMO VERSION');
    const match_posto = pdf_text.includes('Posto Fiscal: CENTRAL DAS TRANSPORTADORAS');

    if (match_relatorio) {
        tipo_pdf = 1;
    } else if (match_demo) {
        tipo_pdf = 2;
        if (match_posto) {
            tipo_pdf = 3;
        }
    } else {
        tipo_pdf = 4;
    }

    const data_emissao = extractDataOrNone(pdf_text, /Data de Emissão\s*[\n\r]+\s*(\d{2}\/\d{2}\/\d{4})/) ||
                         extractDataOrNone(pdf_text, /Data:(\d{2}\/\d{2}\/\d{4})/);

    const chave_mdfe_cnpj_regex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+(\d{44})/;
    const match_mdfe_cnpj = pdf_text.match(chave_mdfe_cnpj_regex);
    const global_chave_mdfe = match_mdfe_cnpj ? match_mdfe_cnpj[1] : null;

    debugLog('Chave do MDF-e extraída globalmente:', global_chave_mdfe);
    let termos_averguacao_matches = [];

    debugLog(`Tipo de PDF detectado: ${tipo_pdf}`);

    if (tipo_pdf === 1) {
        termos_averguacao_matches = [...pdf_text.matchAll(
            /(?:-\s*(\d+)\s*-\s*(?:Pendente|Pago)?)?\s*[\n\r]+\s*(\d{44})\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d+)/g
        )];
        debugLog('Matches para Tipo 1:', termos_averguacao_matches.length);

    } else if (tipo_pdf === 2) {
        termos_averguacao_matches = [...pdf_text.matchAll(
            /Chave da NF-e\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d{44})\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d+)/g
        )];
        debugLog('Matches para Tipo 2:', termos_averguacao_matches.length);

    } else if (tipo_pdf === 3) {
        termos_averguacao_matches = [...pdf_text.matchAll(
            /Nº do CT-e\s*(\d{44})\s*([\d.]+)\s*([\d.]+)\s*([\d.]+)/g
        )];
        debugLog('Matches para Tipo 3:', termos_averguacao_matches.length);
    }

    if (termos_averguacao_matches.length > 0) {
        for (const match of termos_averguacao_matches) {
            let pos_1, pos_2, pos_3, pos_4;

            if (tipo_pdf === 1) {
                pos_1 = match[1];
                pos_2 = match[2];
                pos_3 = match[3];
                pos_4 = match[4];

                const current_pos_1 = pos_1 || numero_termo_anterior;

                dados_termos_averguacao.push([data_emissao, global_chave_mdfe, current_pos_1, pos_2, pos_4, pos_3]);
                numero_termo_anterior = current_pos_1 || '';

            } else if (tipo_pdf === 2) {
                pos_1 = match[1];
                pos_2 = match[2];
                pos_3 = match[3];
                pos_4 = match[4];

                dados_termos_averguacao.push([data_emissao, global_chave_mdfe, pos_4, pos_2, pos_1, pos_3]);
                numero_termo_anterior = pos_4 || '';

            } else if (tipo_pdf === 3) {
                pos_1 = match[1];
                pos_2 = match[2];
                pos_3 = match[3];
                pos_4 = match[4];

                dados_termos_averguacao.push([
                    data_emissao,
                    global_chave_mdfe,
                    pos_2 ? pos_2.replace(/\./g, "") : '',
                    pos_1 ? pos_1.replace(/\./g, "") : '',
                    pos_4 ? pos_4.replace(/\./g, "") : '',
                    pos_3 ? pos_3.replace(/\./g, "") : ''
                ]);
                numero_termo_anterior = pos_2 ? pos_2.replace(/\./g, "") : '';
            }
        }
    }

    const filteredData = dados_termos_averguacao.filter(d => d && d.length === 6);
    debugLog('Tipo do PDF: ', tipo_pdf);
    debugLog('Dados filtrados antes de retornar:', filteredData);
    return filteredData;
}

module.exports = {
    processPdfAndSaveData,
    extractDataFromPdfText,
    extractDataOrNone,
};