// backend/services/pdfProcessor.js

const pdfParse = require('pdf-parse');
// Não precisamos mais do sqlite3 aqui diretamente, ele é gerenciado pelo database.js
// const sqlite3 = require('sqlite3').verbose();
// const path = require('path');
// const fs = require('fs'); // Apenas se houver necessidade de leitura/escrita de arquivos locais, que não é o caso aqui

// Importa as funções do banco de dados centralizadas
const {
    createSefazReportTable,
    createTermosInseridosTable,
    clearTermosInseridosTable,
    insertNumeroTermo,
    insertSefazReportData,
    // Não precisa importar connectSQLite aqui, as funções já o fazem
} = require('../database'); // Ajuste o caminho conforme a estrutura da sua pasta

const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';

const debugLog = (...args) => { if (LOG_DEBUG) { console.log('[DEBUG-PDF-PROCESSOR]', ...args); } };
const debugWarn = (...args) => { if (LOG_DEBUG) { console.warn('[DEBUG-PDF-PROCESSOR]', ...args); } };
const debugError = (...args) => { console.error('[ERROR-PDF-PROCESSOR]', ...args); };

// Remove as funções de criação de tabela e inserção de dados SQLite deste arquivo
// createDadosTable e insertDadosSQLite não são mais necessárias aqui.
// Elas foram movidas e renomeadas para database.js

async function processPdfAndSaveData(pdfBuffer, numeroVoo, dataRegistro) {
    let db; // Esta variável não é mais uma conexão direta, pois cada função de DB a gerencia
    try {
        debugLog('--- Início de processPdfAndSaveData ---');
        debugLog('Processando PDF para número de voo:', numeroVoo, 'e data de registro:', dataRegistro);

        // A conexão ao DB é feita internamente por cada função de DB agora,
        // então não precisamos de `db = connectSQLite();` aqui.

        const data = await pdfParse(pdfBuffer);
        const pdfText = data.text;
        debugLog('Texto extraído do PDF:\n', pdfText);
        debugLog('Tamanho total do texto extraído:', pdfText.length);

        const extractedData = extractDataFromPdfText(pdfText);
        debugLog('Dados extraídos de extractDataFromPdfText:', extractedData);

        if (extractedData.length === 0) {
            debugWarn('Nenhum dado válido foi extraído do PDF. Nenhuma inserção será feita.');
            return true;
        }

        // Chamadas às funções centralizadas do database.js
        debugLog('Criando/limpando tabela termos_inseridos...');
        await createTermosInseridosTable(); // Chamada sem 'db'
        await clearTermosInseridosTable();  // Chamada sem 'db'
        debugLog('Tabela termos_inseridos pronta.');

        debugLog('Iniciando inserção de dados principais em sefaz_report...');
        await insertSefazReportData(extractedData, numeroVoo, dataRegistro); // Chamada sem 'db'
        debugLog('Inserção de dados principais em sefaz_report concluída.');

        debugLog('Iniciando inserção de números de termo...');
        for (const dado of extractedData) {
            if (dado && dado[2]) {
                debugLog('Inserindo número de termo:', dado[2]);
                await insertNumeroTermo(dado[2]); // Chamada sem 'db'
            }
        }
        debugLog('Inserção de números de termo concluída.');

        debugLog("Processamento do PDF e dados salvos com sucesso no SQLite.");
        return true;

    } catch (error) {
        debugError("Erro durante o processamento do PDF e salvamento no SQLite:", error);
        return false;
    } finally {
        // Não há mais db.close() aqui, pois cada função de DB fecha sua própria conexão
        debugLog('--- Fim de processPdfAndSaveData ---');
    }
}




// Funções de extração de dados (convertidas do Python para JavaScript)
function extractDataOrNone(text, pattern) {
    const match = text.match(pattern);
    return match ? match[1] : null;
}

// backend/services/pdfProcessor.js (APENAS A FUNÇÃO extractDataFromPdfText)

function extractDataFromPdfText(pdf_text) {
    let tipo_pdf;
    const dados_termos_averguacao = [];
    let numero_termo_anterior = '';

    // Prioriza a detecção do tipo 1 (Relatório de Termos de Averiguação)
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
        tipo_pdf = 4; // Tipo genérico se nenhum dos outros for detectado
    }

    const data_emissao = extractDataOrNone(pdf_text, /Data de Emissão\s*[\n\r]+\s*(\d{2}\/\d{2}\/\d{4})/) ||
        extractDataOrNone(pdf_text, /Data:(\d{2}\/\d{2}\/\d{4})/);

    // AQUI ESTAVA O PROBLEMA: Use a `extracted_chave_mdfe` que você logou e confirmou.
    const chave_mdfe_cnpj_regex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+(\d{44})/;
    const match_mdfe_cnpj = pdf_text.match(chave_mdfe_cnpj_regex);
    const global_chave_mdfe = match_mdfe_cnpj ? match_mdfe_cnpj[1] : null; // Renomeado para clareza

    debugLog('Chave do MDF-e extraída globalmente:', global_chave_mdfe);
    let termos_averguacao_matches = [];


    // Debug para confirmar o tipo de PDF detectado
    debugLog(`Tipo de PDF detectado: ${tipo_pdf}`);

    if (tipo_pdf === 1) {
        // Regex corrigida: torna o grupo do número do termo e status opcional.
        // (?:-\s*(\d+)\s*-\s*(?:Pendente|Pago)?)? : Este é o grupo chave.
        // (?: ... )? : Torna todo o grupo opcional (não-capturante).
        // (\d+) : Este é o grupo que captura o número do termo (match[1]).
        termos_averguacao_matches = [...pdf_text.matchAll(
            /(?:-\s*(\d+)\s*-\s*(?:Pendente|Pago)?)?\s*[\n\r]+\s*(\d{44})\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d+)/g
        )];
        debugLog('Matches para Tipo 1:', termos_averguacao_matches.length);

    } else if (tipo_pdf === 2) {
        // Reajustar com base no formato real de PDF Tipo 2
        // Exemplo da sua regex antiga: (?:Chave da NF-e)?\n(\d+)\n(\d{44})\n(\d+)\n(\d+)
        termos_averguacao_matches = [...pdf_text.matchAll(
            /Chave da NF-e\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d{44})\s*[\n\r]+\s*(\d+)\s*[\n\r]+\s*(\d+)/g
        )];
        debugLog('Matches para Tipo 2:', termos_averguacao_matches.length);

    } else if (tipo_pdf === 3) {
        // Reajustar com base no formato real de PDF Tipo 3
        // Exemplo da sua regex antiga: Nº do CT-e\s*(\d{44})\s*([\d.]+)\s*([\d.]+)\s*([\d.]+)
        termos_averguacao_matches = [...pdf_text.matchAll(
            /Nº do CT-e\s*(\d{44})\s*([\d.]+)\s*([\d.]+)\s*([\d.]+)/g
        )];
        debugLog('Matches para Tipo 3:', termos_averguacao_matches.length);
    }

    if (termos_averguacao_matches.length > 0) {
        for (const match of termos_averguacao_matches) {
            let pos_1, pos_2, pos_3, pos_4;

            if (tipo_pdf === 1) {
                pos_1 = match[1]; // Nº Termo Averiguação
                pos_2 = match[2]; // Chave da NF-e
                pos_3 = match[3]; // N° da NFe
                pos_4 = match[4]; // Nº do CT-e

                const current_pos_1 = pos_1 || numero_termo_anterior;

                // --- MUDANÇA CRÍTICA AQUI ---
                // Use 'global_chave_mdfe' que você extraiu e logou como correta
                dados_termos_averguacao.push([data_emissao, global_chave_mdfe, current_pos_1, pos_2, pos_4, pos_3]);
                // --- FIM DA MUDANÇA CRÍTICA ---
                numero_termo_anterior = current_pos_1 || '';

            } else if (tipo_pdf === 2) {
                pos_1 = match[1]; // N° CT-e
                pos_2 = match[2]; // Chave da NF-e
                pos_3 = match[3]; // N° NFe
                pos_4 = match[4]; // Nº Termo Averiguação

                dados_termos_averguacao.push([data_emissao, global_chave_mdfe, pos_4, pos_2, pos_1, pos_3]); // <-- Ajuste aqui também
                numero_termo_anterior = pos_4 || '';

            } else if (tipo_pdf === 3) {
                pos_1 = match[1]; // Chave CT-e
                pos_2 = match[2]; // Nº do Termo
                pos_3 = match[3]; // Algum valor numérico
                pos_4 = match[4]; // Outro valor numérico

                dados_termos_averguacao.push([
                    data_emissao,
                    global_chave_mdfe, // <-- Ajuste aqui também
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
    // Remover as exportações de funções de DB que foram movidas
    // connectSQLite,
    // createTermosInseridosTable,
    // clearTermosInseridosTable,
    // insertNumeroTermo,
    // createDadosTable,
    // insertDadosSQLite,
    extractDataFromPdfText,
    extractDataOrNone,
};