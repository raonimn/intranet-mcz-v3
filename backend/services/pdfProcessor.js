// backend/services/pdfProcessor.js
const pdfParse = require('pdf-parse');
const {
    insertSefazReportData,
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

        debugLog('Iniciando inserção de dados principais em sefaz_report...');
        const { insertedCount, duplicateCount, totalProcessed } = await insertSefazReportData(extractedData, numeroVoo, dataRegistro);
        debugLog('Inserção de dados principais em sefaz_report concluída.');

        debugLog("Processamento do PDF e dados salvos com sucesso no SQLite.");
        return { success: true, insertedCount, duplicateCount, totalProcessed, message: 'PDF processado com sucesso.' };

    } catch (error) {
        debugError("Erro durante o processamento do PDF e salvamento no SQLite:", error);
        return { success: false, insertedCount: 0, duplicateCount: 0, totalProcessed: 0, message: error.message || 'Erro desconhecido durante o processamento do PDF.' };
    } finally {
        debugLog('--- Fim de processPdfAndSaveData ---');
    }
}

// Função auxiliar para extrair dados com base em um padrão regex
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
        tipo_pdf = 1; // "Relatório de Termos de Averiguação dos MDF-es"
    } else if (match_demo) {
        if (match_posto) {
            tipo_pdf = 3; // "DEMO VERSION" e "Posto Fiscal: CENTRAL DAS TRANSPORTADORAS"
        } else {
            tipo_pdf = 2; // "DEMO VERSION"
        }
    } else {
        tipo_pdf = 4; // Tipo desconhecido (fallback)
    }

    const data_emissao = extractDataOrNone(pdf_text, /Data de Emissão\s*[\n\r]+\s*(\d{2}\/\d{2}\/\d{4})/) ||
                        extractDataOrNone(pdf_text, /Data:(\d{2}\/\d{2}\/\d{4})/);

    // Regex para capturar a Chave do MDF-e (44 dígitos, pode ter um CNPJ antes)
    const chave_mdfe_regex = /(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+)?(\d{44})/;
    const match_mdfe = pdf_text.match(chave_mdfe_regex);
    const global_chave_mdfe = match_mdfe ? match_mdfe[1] : null;

    debugLog('Chave do MDF-e extraída globalmente:', global_chave_mdfe);
    let termos_averguacao_matches = [];

    debugLog(`Tipo de PDF detectado: ${tipo_pdf}`);

    if (tipo_pdf === 1) {
        // Padrão para "Relatório de Termos de Averiguação dos MDF-es"
        // Captura: (opcional) Número do Termo, Chave NF-e (44 digitos), Número da NFe, Número do CT-e
        // Ex: - 1234 - Pendente\n12345678901234567890123456789012345678901234\n56789\n987654
        termos_averguacao_matches = [...pdf_text.matchAll(
            /(?:-\s*(\d+)\s*-\s*(?:Pendente|Pago)?)?\s*[\n\r]+\s*(\d{44})\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d+)/g
        )];
        debugLog('Matches para Tipo 1:', termos_averguacao_matches.length);

    } else if (tipo_pdf === 2) {
        // Padrão para "DEMO VERSION" (sem Posto Fiscal)
        // Captura: Chave NF-e (44 digitos), Número CT-e, Número NFe, Número Termo
        // O termo parece ser o último dos 4 grupos numéricos antes da próxima "Chave da NF-e"
        // Ex: Chave da NF-e\n12345\n12345678901234567890123456789012345678901234\n98765\n54321
        termos_averguacao_matches = [...pdf_text.matchAll(
            /Chave da NF-e\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d{44})\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d+)/g
        )];
        debugLog('Matches para Tipo 2:', termos_averguacao_matches.length);

    } else if (tipo_pdf === 3) {
        // Padrão para "DEMO VERSION" e "Posto Fiscal: CENTRAL DAS TRANSPORTADORAS"
        // Captura: Chave CT-e (44 digitos), Nº Termo, Nº NFe, Data emissão CT-e/NFe (não a data global)
        // Ex: Nº do CT-e 12345678901234567890123456789012345678901234 123.456 789.012 01/01/2023
        // Modificado para capturar os 3 números subsequentes após a Chave CT-e
        termos_averguacao_matches = [...pdf_text.matchAll(
            /Nº do CT-e\s*(\d{44})\s*([\d.]+)\s*([\d.]+)\s*([\d.]+)/g
        )];
        debugLog('Matches para Tipo 3:', termos_averguacao_matches.length);
    } else {
        debugWarn('Tipo de PDF desconhecido. Não foi possível extrair dados de termos de averiguação.');
    }


    if (termos_averguacao_matches.length > 0) {
        for (const match of termos_averguacao_matches) {
            let parsed_numero_termo;
            let parsed_chave_nfe;
            let parsed_numero_cte;
            let parsed_numero_nfe;

            if (tipo_pdf === 1) {
                // match[1]: numero_termo (opcional)
                // match[2]: chave_nfe
                // match[3]: numero_nfe
                // match[4]: numero_cte
                parsed_numero_termo = match[1] || numero_termo_anterior; // Usa o anterior se não houver
                parsed_chave_nfe = match[2];
                parsed_numero_nfe = match[3];
                parsed_numero_cte = match[4];

                dados_termos_averguacao.push([data_emissao, global_chave_mdfe, parsed_numero_termo, parsed_chave_nfe, parsed_numero_cte, parsed_numero_nfe]);
                numero_termo_anterior = parsed_numero_termo || ''; // Atualiza para o próximo ciclo

            } else if (tipo_pdf === 2) {
                // match[1]: numero_cte
                // match[2]: chave_nfe
                // match[3]: numero_nfe
                // match[4]: numero_termo
                parsed_numero_termo = match[4];
                parsed_chave_nfe = match[2];
                parsed_numero_cte = match[1];
                parsed_numero_nfe = match[3];

                dados_termos_averguacao.push([data_emissao, global_chave_mdfe, parsed_numero_termo, parsed_chave_nfe, parsed_numero_cte, parsed_numero_nfe]);
                numero_termo_anterior = parsed_numero_termo || '';

            } else if (tipo_pdf === 3) {
                // match[1]: chave_cte
                // match[2]: numero_termo (provável)
                // match[3]: numero_nfe (provável)
                // match[4]: numero_cte (provável)
                parsed_chave_nfe = match[1].replace(/\./g, ""); // A chave do CTE aqui é a chave da NFe
                parsed_numero_termo = match[2] ? match[2].replace(/\./g, "") : '';
                parsed_numero_nfe = match[3] ? match[3].replace(/\./g, "") : '';
                parsed_numero_cte = match[4] ? match[4].replace(/\./g, "") : '';

                dados_termos_averguacao.push([
                    data_emissao,
                    global_chave_mdfe,
                    parsed_numero_termo,
                    parsed_chave_nfe,
                    parsed_numero_cte,
                    parsed_numero_nfe
                ]);
                numero_termo_anterior = parsed_numero_termo || '';
            }
        }
    }

    const filteredData = dados_termos_averguacao.filter(d => d && d.length === 6 && d[3] && d[3].length === 44); // Garante 6 colunas e chave_nfe válida
    debugLog('Dados filtrados antes de retornar:', filteredData);
    return filteredData;
}

module.exports = {
    processPdfAndSaveData,
    extractDataFromPdfText,
    extractDataOrNone,
};