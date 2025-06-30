// backend/services/pdfProcessor.js

const pdfParse = require('pdf-parse');
const {
    insertSefazReportData,
} = require('../database');

const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';

const debugLog = (...args) => { if (LOG_DEBUG) { console.log('[DEBUG-PDF-PROCESSOR]', ...args); } };
const debugWarn = (...args) => { if (LOG_DEBUG) { console.warn('[DEBUG-PDF-PROCESSOR]', ...args); } };
const debugError = (...args) => { console.error('[ERROR-PDF-PROCESSOR]', ...args); };

async function processPdfAndSaveData(pdfBuffer, numeroVoo) {
    try {
        debugLog('--- Início de processPdfAndSaveData ---');
        debugLog('Processando PDF para número de voo:', numeroVoo);

        const data = await pdfParse(pdfBuffer);
        const pdfText = data.text;
        debugLog('PDF Raw Text:\n', pdfText); // Mantenha para análise
        debugLog('Tamanho total do texto extraído:', pdfText.length);

        const extractedData = extractDataFromPdfText(pdfText);
        debugLog('Dados extraídos de extractDataFromPdfText:', extractedData);

        if (extractedData.length === 0) {
            debugWarn('Nenhum dado válido foi extraído do PDF. Nenhuma inserção será feita.');
            return { success: true, insertedCount: 0, duplicateCount: 0, totalProcessed: 0, extractedData: [], message: 'Nenhum dado válido foi extraído do PDF.' };
        }

        debugLog('Iniciando inserção de dados principais em sefaz_report...');
        const { insertedCount, duplicateCount, totalProcessed } = await insertSefazReportData(extractedData, numeroVoo);
        debugLog('Inserção de dados principais em sefaz_report concluída.');

        debugLog("Processamento do PDF e dados salvos com sucesso no MySQL.");
        return { success: true, insertedCount, duplicateCount, totalProcessed, extractedData: extractedData, message: 'PDF processado com sucesso.' };

    } catch (error) {
        debugError("Erro durante o processamento do PDF e salvamento no MySQL:", error);
        return { success: false, insertedCount: 0, duplicateCount: 0, totalProcessed: 0, extractedData: [], message: error.message || 'Erro desconhecido durante o processamento do PDF.' };
    } finally {
        debugLog('--- Fim de processPdfAndSaveData ---');
    }
}

function extractDataOrNone(text, pattern) {
    const match = text.match(pattern);
    return match ? match[1] : null;
}

function parseAndFormatDateFromRodape(dateString) {
    if (!dateString) return null;

    const monthMap = {
        'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06',
        'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
    };

    const match = dateString.match(/(\d{1,2})\s+de\s+([a-zA-ZçÇ]+)\s+de\s+(\d{4})/i);
    if (match) {
        let day = match[1].padStart(2, '0');
        let monthName = match[2].toLowerCase();
        let year = match[3];

        let monthNumber = monthMap[monthName];
        if (monthNumber) {
            return `${day}/${monthNumber}/${year}`;
        }
    }
    return null;
}


function extractDataFromPdfText(pdf_text) {
    let tipo_pdf;
    const dados_termos_averiguacao = [];

    const match_relatorio = pdf_text.includes('Relatório de Termos de Averiguação dos MDF-es');
    const match_demo = pdf_text.includes('DEMO VERSION');
    const match_posto = pdf_text.includes('Posto Fiscal: CENTRAL DAS TRANSPORTADORAS');
    
    const new_pattern_indicator = pdf_text.includes('Relatório de Termos de Averiguação dos MDF-es') && pdf_text.includes('Qtde de TAs:');

    if (new_pattern_indicator) {
        tipo_pdf = 5; // Novo tipo para este padrão específico
    } else if (match_relatorio) {
        tipo_pdf = 1; // Relatório de Termos (padrão antigo, se houver)
    } else if (match_demo) {
        if (match_posto) {
            tipo_pdf = 3; // DEMO + Posto Fiscal
        } else {
            tipo_pdf = 2; // DEMO normal
        }
    } else {
        tipo_pdf = 4; // Tipo desconhecido (fallback)
    }

    const data_emissao_raw = extractDataOrNone(pdf_text, /Emitido pelo usuário \d+ em (\d{1,2} de [a-zA-ZçÇ]+ de \d{4} \d{2}:\d{2})/) ||
                             extractDataOrNone(pdf_text, /Data de Emissão\s*[\n\r]+\s*(\d{2}\/\d{2}\/\d{4})/) ||
                             extractDataOrNone(pdf_text, /Data:(\d{2}\/\d{2}\/\d{4})/);

    let data_emissao_formatada = null;
    if (data_emissao_raw) {
        data_emissao_formatada = parseAndFormatDateFromRodape(data_emissao_raw);
        if (!data_emissao_formatada && /^\d{2}\/\d{2}\/\d{4}$/.test(data_emissao_raw)) {
            data_emissao_formatada = data_emissao_raw;
        }
    }
    debugLog('Data de Emissão formatada (do PDF):', data_emissao_formatada || 'N/A');

    const chave_mdfe_regex = /(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+)?(\d{44})/;
    const match_mdfe = pdf_text.match(chave_mdfe_regex);
    const global_chave_mdfe = match_mdfe ? match_mdfe[1] : null;

    debugLog('Chave do MDF-e extraída globalmente:', global_chave_mdfe);
    
    debugLog(`Tipo de PDF detectado: ${tipo_pdf}`);

    if (tipo_pdf === 5) {
        // --- NOVA ESTRATÉGIA FINAL: Capture o bloco de 4 linhas e reordene ---
        // Padrão:
        // Linha 1: <CHAVE_NF_E>
        // Linha 2: <NUMERO_CT_E>
        // Linha 3: Nº <NUMERO_TERMO> - Situação: ...
        // Linha 4: <NUMERO_NF_E>

        const regexTipo5Final = new RegExp(
            `(\\d{44})` + // Grupo 1: Chave NF-e
            `\\s*` +    // Zero ou mais espaços/quebras de linha
            `(\\d+)` +  // Grupo 2: Número CT-e
            `\\s*` +    // Zero ou mais espaços/quebras de linha
            `Nº\\s*(\\d+)\\s*-\\s*Situação:[^\\d\\r\\n]+?` + // Grupo 3: Número Termo
            `\\s*` +    // Zero ou mais espaços/quebras de linha
            `(\\d+)`,   // Grupo 4: Número NF-e
            'g' // Flag global para encontrar todas as ocorrências
        );

        termos_averiguacao_matches = [...pdf_text.matchAll(regexTipo5Final)];
        debugLog('Matches para Tipo 5 (blocos finais):', termos_averiguacao_matches.length, termos_averiguacao_matches.map(m => m[0]));

        for (const match of termos_averiguacao_matches) {
            const chave_nfe_raw = match[1];
            const numero_cte_raw = match[2];
            const numero_termo_raw = match[3];
            const numero_nfe_raw = match[4];

            // Reordenar para a estrutura esperada pelo banco de dados:
            // data_emissao, chave_mdfe, numero_termo, chave_nfe, numero_cte, numero_nfe
            dados_termos_averiguacao.push([
                data_emissao_formatada,
                global_chave_mdfe,
                numero_termo_raw,   // Ordem ajustada aqui
                chave_nfe_raw,
                numero_cte_raw,
                numero_nfe_raw      // Ordem ajustada aqui
            ]);
        }

    } else if (tipo_pdf === 1) { // Padrão original de Relatório de Termos
        termos_averiguacao_matches = [...pdf_text.matchAll(
            /(?:(\d+) - )?(?:Pendente|Pago)?\n(\d{44})\n(\d+)\n(\d+)/g
        )];
        debugLog('Matches para Tipo 1 (original):', termos_averiguacao_matches.length);

        let numero_termo_anterior = '';
        for (const match of termos_averiguacao_matches) {
            const current_numero_termo = match[1] || numero_termo_anterior;
            const chave_nfe = match[2];
            const numero_nfe = match[3];
            const numero_cte = match[4];
            
            dados_termos_averiguacao.push([data_emissao_formatada, global_chave_mdfe, current_numero_termo, chave_nfe, numero_cte, numero_nfe]);
            numero_termo_anterior = current_numero_termo || '';
        }

    } else if (tipo_pdf === 2) { // DEMO VERSION
        termos_averiguacao_matches = [...pdf_text.matchAll(
            /Chave da NF-e\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d{44})\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d+)/g
        )];
        debugLog('Matches para Tipo 2:', termos_averiguacao_matches.length);
        for (const match of termos_averiguacao_matches) {
            dados_termos_averiguacao.push([data_emissao_formatada, global_chave_mdfe, match[4], match[2], match[1], match[3]]);
        }

    } else if (tipo_pdf === 3) { // DEMO VERSION + Posto Fiscal
        termos_averiguacao_matches = [...pdf_text.matchAll(
            /Nº do CT-e\s*(\d{44})\s*([\d.]+)\s*([\d.]+)\s*([\d.]+)/g
        )];
        debugLog('Matches para Tipo 3:', termos_averiguacao_matches.length);
        for (const match of termos_averiguacao_matches) {
            dados_termos_averiguacao.push([
                data_emissao_formatada,
                global_chave_mdfe,
                match[2] ? match[2].replace(/\./g, "") : '', // numero_termo
                match[1].replace(/\./g, ""), // chave_nfe
                match[4] ? match[4].replace(/\./g, "") : '', // numero_cte
                match[3] ? match[3].replace(/\./g, "") : ''  // numero_nfe
            ]);
        }
    } else {
        debugWarn('Tipo de PDF desconhecido. Não foi possível extrair dados de termos de averiguação.');
    }

    const filteredData = dados_termos_averiguacao.filter(d => d && d.length === 6 && d[3] && d[3].length === 44);
    debugLog('Dados filtrados antes de retornar:', filteredData);
    return filteredData;
}

module.exports = {
    processPdfAndSaveData,
    extractDataFromPdfText,
    extractDataOrNone,
};