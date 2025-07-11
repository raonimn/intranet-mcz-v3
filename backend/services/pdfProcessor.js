// backend/services/pdfProcessor.js

const pdfParse = require('pdf-parse');
const {
    insertSefazReportData,
} = require('../database');

const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';

const debugLog = (...args) => { if (LOG_DEBUG) { console.log('[DEBUG-PDF-PROCESSOR]', ...args); } };
const debugWarn = (...args) => { if (LOG_DEBUG) { console.warn('[DEBUG-PDF-PROCESSOR]', ...args); } };
const debugError = (...args) => { console.error('[ERROR-PDF-PROCESSOR]', ...args); };

// --- MODIFICADO ---: A assinatura da função não recebe mais 'numeroVoo'
async function processPdfAndSaveData(pdfBuffer) {
    try {
        debugLog('--- Início de processPdfAndSaveData ---');
        // A linha de log com 'numeroVoo' foi removida

        const data = await pdfParse(pdfBuffer);
        const pdfText = data.text;
        debugLog('Dados extraídos:', pdfText || 'N/A');

        // --- MODIFICADO ---: 'extractDataFromPdfText' agora retorna um objeto com os dados e o número do voo.
        const { extractedData, numeroVoo } = extractDataFromPdfText(pdfText);
        //debugLog('Dados extraídos de extractDataFromPdfText:', extractedData);
        debugLog('Número do Voo extraído automaticamente:', numeroVoo || 'N/A');

        if (extractedData.length === 0) {
            debugWarn('Nenhum dado válido foi extraído do PDF. Nenhuma inserção será feita.');
            // --- MODIFICADO ---: Retornamos o numeroVoo como nulo aqui também.
            return { success: true, insertedCount: 0, duplicateCount: 0, totalProcessed: 0, extractedData: [], numeroVoo: null, message: 'Nenhum dado válido foi extraído do PDF.' };
        }

        debugLog('Iniciando inserção de dados principais em sefaz_report...');
        // O numeroVoo extraído é passado para a função do banco de dados.
        const { insertedCount, duplicateCount, totalProcessed } = await insertSefazReportData(extractedData, numeroVoo);
        debugLog('Inserção de dados principais em sefaz_report concluída.');

        debugLog("Processamento do PDF e dados salvos com sucesso no MySQL.");
        // --- MODIFICADO ---: O retorno agora inclui o 'numeroVoo' para ser usado na resposta da API.
        return { success: true, insertedCount, duplicateCount, totalProcessed, extractedData: extractedData, numeroVoo: numeroVoo, message: 'PDF processado com sucesso.' };

    } catch (error) {
        debugError("Erro durante o processamento do PDF e salvamento no MySQL:", error);
        return { success: false, insertedCount: 0, duplicateCount: 0, totalProcessed: 0, extractedData: [], numeroVoo: null, message: error.message || 'Erro desconhecido durante o processamento do PDF.' };
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


// --- MODIFICADO ---: A função agora retorna um objeto.
function extractDataFromPdfText(pdf_text) {
    let tipo_pdf;
    const dados_termos_averiguacao = [];
    let numeroVoo = null;

    const match_relatorio = pdf_text.includes('Relatório de Termos de Averiguação dos MDF-es');
    const match_demo = pdf_text.includes('DEMO VERSION');
    const match_posto = pdf_text.includes('Posto Fiscal: CENTRAL DAS TRANSPORTADORAS');

    // Corrigido para incluir 'TAS' (com S) que aparece em alguns PDFs
    const new_pattern_indicator = pdf_text.includes('Relatório de Termos de Averiguação dos MDF-es') && (pdf_text.includes('Qtde de TAs:') || pdf_text.includes('Qtde de TAS:'));

    if (new_pattern_indicator) {
        tipo_pdf = 5;
    } else if (match_relatorio) {
        tipo_pdf = 1;
    } else if (match_demo) {
        if (match_posto) {
            tipo_pdf = 3;
        } else {
            tipo_pdf = 2;
        }
    } else {
        tipo_pdf = 4;
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

    if (global_chave_mdfe && global_chave_mdfe.length === 44) {
        const vooDigits = global_chave_mdfe.slice(-5, -1);
        if (/^\d{4}$/.test(vooDigits)) {
            numeroVoo = `AD${vooDigits}`;
        }
    }

    console.log(`Tipo de PDF detectado: ${tipo_pdf}`);
    
    if (tipo_pdf === 5) {
        // --- LÓGICA FINAL BASEADA NOS PADRÕES DE 3 E 4 LINHAS ---
        const lines = pdf_text.split('\n').map(line => line.trim()).filter(line => line); // Limpa e filtra linhas vazias

        let numero_termo_atual = '';
        let i = 0;

        const chaveRegex = /^\d{44}$/;
        const numeroRegex = /^\d+$/;
        const termoRegex = /^N[º°]\s*(\d+)\s*-\s*Situação:/;

        while (i < lines.length) {
            // Tenta corresponder ao padrão de 4 linhas (com termo)
            if (i + 3 < lines.length &&
                lines[i].match(chaveRegex) &&
                lines[i + 1].match(numeroRegex) &&
                lines[i + 2].match(termoRegex) &&
                lines[i + 3].match(numeroRegex)) {
                const chave_nfe = lines[i];
                const numero_cte = lines[i + 1];
                const termoMatch = lines[i + 2].match(termoRegex);
                numero_termo_atual = termoMatch[1]; // Atualiza o termo atual
                const numero_nfe = lines[i + 3];

                dados_termos_averiguacao.push([
                    data_emissao_formatada, global_chave_mdfe, numero_termo_atual, chave_nfe, numero_cte, numero_nfe
                ]);
                i += 4; // Avança 4 linhas
            }
            // Tenta corresponder ao padrão de 3 linhas (sem termo)
            else if (i + 2 < lines.length &&
                lines[i].match(chaveRegex) &&
                lines[i + 1].match(numeroRegex) &&
                lines[i + 2].match(numeroRegex)) {
                const chave_nfe = lines[i];
                const numero_cte = lines[i + 1];
                const numero_nfe = lines[i + 2];

                // Usa o último termo encontrado
                if (numero_termo_atual) {
                    dados_termos_averiguacao.push([
                        data_emissao_formatada, global_chave_mdfe, numero_termo_atual, chave_nfe, numero_cte, numero_nfe
                    ]);
                }
                i += 3; // Avança 3 linhas
            }
            // Se nenhum padrão corresponder, avança 1 para evitar loop infinito
            else {
                i++;
            }
        }
    } else if (tipo_pdf === 1) {
        // Lógica para o tipo 1 (que já estava funcionando)
        const termos_averiguacao_matches = [...pdf_text.matchAll(
            /(?:(\d+) - )?(?:Pendente|Pago)?\n(\d{44})\n(\d+)\n(\d+)/g
        )];
        let numero_termo_anterior = '';
        for (const match of termos_averiguacao_matches) {
            const current_numero_termo = match[1] || numero_termo_anterior;
            const chave_nfe = match[2];
            const numero_nfe = match[3];
            const numero_cte = match[4];

            dados_termos_averiguacao.push([data_emissao_formatada, global_chave_mdfe, current_numero_termo, chave_nfe, numero_cte, numero_nfe]);
            numero_termo_anterior = current_numero_termo || '';
        }

    } else if (tipo_pdf === 2) {
        const termos_averiguacao_matches = [...pdf_text.matchAll(
            /Chave da NF-e\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d{44})\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d+)/g
        )];
        for (const match of termos_averiguacao_matches) {
            dados_termos_averiguacao.push([data_emissao_formatada, global_chave_mdfe, match[4], match[2], match[1], match[3]]);
        }

    } else if (tipo_pdf === 3) {
        const termos_averiguacao_matches = [...pdf_text.matchAll(
            /Nº do CT-e\s*(\d{44})\s*([\d.]+)\s*([\d.]+)\s*([\d.]+)/g
        )];
        for (const match of termos_averiguacao_matches) {
            dados_termos_averiguacao.push([
                data_emissao_formatada,
                global_chave_mdfe,
                match[2] ? match[2].replace(/\./g, "") : '',
                match[1].replace(/\./g, ""),
                match[4] ? match[4].replace(/\./g, "") : '',
                match[3] ? match[3].replace(/\./g, "") : ''
            ]);
        }
    } else {
        debugWarn('Tipo de PDF desconhecido. Não foi possível extrair dados de termos de averiguação.');
    }

    const filteredData = dados_termos_averiguacao.filter(d => d && d.length === 6 && d[3] && d[3].length === 44);
    debugLog('Dados filtrados antes de retornar (Total):', filteredData.length);

    return { extractedData: filteredData, numeroVoo };
}




module.exports = {
    processPdfAndSaveData,
    extractDataFromPdfText,
    extractDataOrNone,
};