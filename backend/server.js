// backend/server.js
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const cors = require('cors');

const {
    initializeDatabase,
    pool, // <-- Esta variável 'pool' aqui pode estar undefined quando as rotas são definidas.
    //     Precisamos usar a função getDbPoolInstance() dentro das rotas.
    insertSefazReportData,
    insertFranchiseReportData,
    getSefazReportData,
    getFranchiseReportData,
    insertLog,
    getLastFranchiseImportDate,
    waitForDatabaseTables,
    insertOrUpdateSefazStatusTermos,
    debugLog,
    debugWarn,
    debugError,
    getDbPoolInstance // <--- Certifique-se de exportar e importar esta função
} = require('./database');


const { processPdfAndSaveData } = require('./services/pdfProcessor');


const app = express();
const port = process.env.PORT || 8080;
const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';


app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        const allowedIpPatterns = [
            /^https?:\/\/192\.168\.0\.\d{1,3}(:\d+)?$/,
            /^https?:\/\/10\.0\.0\.\d{1,3}(:\d+)?$/,
            /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
            /^https?:\/\/localhost(:\d+)?$/,
            /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
        ];

        const isAllowed = allowedIpPatterns.some(pattern => {
            if (LOG_DEBUG) {
                console.log(`[CORS-DEBUG] Checking origin: ${origin} against pattern: ${pattern}`);
            }
            return pattern.test(origin);
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Origem não permitida: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const formatDateToDDMMYYYY = (date) => {
    if (!date) return '';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
};

// --- ESTRUTURA PRINCIPAL DO SERVIDOR: initializeDatabase() é chamado e ENVOLVE TODAS AS ROTAS ---
initializeDatabase()
    .then(async () => { // Adicionado 'async' aqui para usar 'await' dentro do .then
        if (LOG_DEBUG) debugLog('[SERVER-INIT] Banco de dados MySQL inicializado com sucesso.');

        // AGUARDAR PELAS TABELAS ANTES DE CONFIGURAR AS ROTAS E INICIAR O SERVIDOR EXPRESS
        const tablesToWaitFor = ['sefaz_report', 'franchise_report', 'logs', 'sefaz_status_termos'];
        const tablesReady = await waitForDatabaseTables(tablesToWaitFor);

        if (!tablesReady) {
            debugError('[SERVER-INIT] Falha crítica: As tabelas do banco de dados não ficaram prontas a tempo. Encerrando servidor.');
            process.exit(1); // Encerrar se as tabelas não estiverem prontas
        }

        // --- DEFINIÇÕES DE ROTAS DO EXPRESS AQUI DENTRO ---
        app.get('/', (req, res) => res.send('Backend rodando! O frontend React deve ser acessado separadamente.'));

        app.post('/api/upload-pdf', upload.single('pdf_file'), async (req, res) => {
            const file = req.file;
            const numeroVoo = req.body.numeroVoo;

            if (!file) {
                await insertLog({ action: 'Falha no Upload de PDF (Arquivo Ausente)', details: {}, success: false });
                return res.status(400).json({ success: false, message: 'Nenhum arquivo PDF enviado.' });
            }
            if (!numeroVoo || !numeroVoo.trim()) {
                await insertLog({ action: 'Falha no Upload de PDF (Voo Ausente)', details: { file: file.originalname }, success: false });
                return res.status(400).json({ success: false, message: 'Por favor, insira o número do voo.' });
            }

            if (LOG_DEBUG) debugLog(`[DEBUG-SERVER] PDF recebido: ${file.originalname}, Número do Voo: ${numeroVoo}`);

            try {
                const result = await processPdfAndSaveData(file.buffer, numeroVoo);

                const formatNumber = (num) => new Intl.NumberFormat('pt-BR').format(num);

                if (result.success) {
                    await insertLog({ action: 'Importação de PDF Concluída', details: { file: file.originalname, voo: numeroVoo, inserted: result.insertedCount, duplicated: result.duplicateCount }, success: true });
                    res.status(200).json({
                        success: true,
                        message: `Voo ${numeroVoo} processado com sucesso.`,
                        recordsProcessed: result.insertedCount,
                        additionalInfo: `Inseridos ${formatNumber(result.insertedCount)} notas. (${formatNumber(result.duplicateCount)} duplicidades ignoradas).`,
                        extractedData: result.extractedData
                    });
                } else {
                    await insertLog({ action: 'Falha no Processamento de PDF', details: { file: file.originalname, voo: numeroVoo, message: result.message }, success: false });
                    res.status(500).json({ success: false, message: result.message || 'Erro ao processar o PDF.' });
                }
            } catch (error) {
                debugError(`[ERROR-SERVER] Erro na rota /api/upload-pdf: ${error.message}`);
                await insertLog({ action: 'Erro Fatal no Upload de PDF', details: { file: file.originalname, voo: numeroVoo, error: error.message }, success: false });
                res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
            }
        });

        app.post('/api/upload-report', upload.single('xlsx_file'), validateXlsx, async (req, res) => {
            const file = req.file;
            let connection; // <-- GARANTA QUE ESTA LINHA ESTEJA AQUI
            if (!file) {
                await insertLog({ action: 'Falha no Upload de XLSX (Arquivo Ausente)', details: {}, success: false });
                return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
            }

            try {
                const buffer = file.buffer;
                const workbook = xlsx.read(buffer, { type: 'buffer' });

                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0 });

                if (LOG_DEBUG) debugLog('[DEBUG-SERVER] JSON data from XLSX (first 5 rows):', jsonData.slice(0, 5));

                const columnsToExtractIndices = [1, 3, 5, 8, 9, 19, 54, 13];

                const processedData = jsonData.slice(1).map((row) => {
                    const mappedRow = columnsToExtractIndices.map((colIndex) => {
                        if (colIndex === 5 && typeof row[colIndex] === 'number') {
                            const excelSerialDate = row[colIndex];
                            const date = new Date(Math.round((excelSerialDate - 25569) * 86400 * 1000));
                            return formatDateToDDMMYYYY(date);
                        }
                        return row[colIndex] || '';
                    });
                    return mappedRow;
                }).filter(row => row.some(cell => cell !== ''));

                if (LOG_DEBUG) debugLog(`[DEBUG-SERVER] Total de linhas processadas do XLSX para inserção: ${processedData.length}`);

                await insertFranchiseReportData(processedData);

                // --- ESTE É O BLOCO CRÍTICO PARA O ERRO 'execute' ---
                const currentPool = await getDbPoolInstance(); // <-- GARANTA QUE ESTA LINHA ESTEJA AQUI
                connection = await currentPool.getConnection(); // <-- E ESTA TAMBÉM
                const [rows] = await connection.execute('SELECT COUNT(*) AS total FROM franchise_report'); // <-- AQUI O ERRO ACONTECIA
                const count = rows[0].total;

                const formatNumber = (num) => new Intl.NumberFormat('pt-BR').format(num);

                await insertLog({ action: 'Importação de Franchise Concluída', details: { file: file.originalname, recordsProcessed: processedData.length }, success: true });
                res.status(200).json({
                    success: true,
                    message: `Dados importados com sucesso! ${formatNumber(processedData.length)} registros processados do arquivo.`,
                    recordsProcessed: processedData.length,
                    additionalInfo: `(${formatNumber(count)} registros no banco)`
                });

            } catch (error) {
                debugError(`[ERROR-SERVER] Erro fatal ao processar arquivo XLSX: ${error.message}`);
                await insertLog({ action: 'Falha na Importação de Franchise', details: { file: file.originalname, error: error.message }, success: false });
                res.status(500).json({
                    success: false,
                    message: 'Erro ao processar arquivo: ' + (error.message || 'Erro desconhecido.')
                });
            } finally {
                if (connection) { // <-- E ESTE FINALLY COM RELEASE
                    connection.release();
                }
            }
        });

        app.get('/api/combined-data-specific', async (req, res) => {
            const { numeroVoo, dataTermo, awb, numeroTermo, destino } = req.query;
            let connection;
            try {
                const currentPool = await getDbPoolInstance();
                connection = await currentPool.getConnection();

                let whereClauses = [];
                let params = [];

                if (numeroVoo && numeroVoo.trim() !== '') {
                    let formattedVoo = numeroVoo.trim();
                    if (formattedVoo.length === 4) {
                        formattedVoo = `AD${formattedVoo}`;
                    }
                    whereClauses.push('sr.numero_voo LIKE ?');
                    params.push(`%${formattedVoo}%`);
                }

                if (dataTermo && dataTermo.trim() !== '') {
                    whereClauses.push("STR_TO_DATE(sr.data_emissao, '%d/%m/%Y') = STR_TO_DATE(?, '%d/%m/%Y')");
                    params.push(dataTermo.trim());
                } else {
                    const today = new Date();
                    const twoDaysAgo = new Date();
                    twoDaysAgo.setDate(today.getDate() - 2);

                    const todayFormattedForQuery = formatDateToDDMMYYYY(today);
                    const twoDaysAgoFormattedForQuery = formatDateToDDMMYYYY(twoDaysAgo);

                    whereClauses.push("STR_TO_DATE(sr.data_emissao, '%d/%m/%Y') BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')");
                    params.push(twoDaysAgoFormattedForQuery);
                    params.push(todayFormattedForQuery);
                }

                if (numeroTermo && numeroTermo.trim() !== '') {
                    whereClauses.push('sr.numero_termo = ?');
                    params.push(numeroTermo.trim());
                }

                let finalHavingClauses = [];
                let finalHavingParams = [];

                if (awb && awb.trim() !== '') {
                    let formattedAwb = awb.trim();
                    if (!formattedAwb.startsWith('577')) {
                        formattedAwb = `577${formattedAwb}`;
                    }
                    finalHavingClauses.push(`sr.awb LIKE ?`);
                    finalHavingParams.push(`%${formattedAwb}%`);
                }
                if (destino && destino.trim() !== '') {
                    finalHavingClauses.push(`fr.destino = ?`);
                    finalHavingParams.push(`${destino.toUpperCase().trim()}`);
                }

                const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
                const havingString = finalHavingClauses.length > 0 ? `HAVING ${finalHavingClauses.join(' AND ')}` : '';

                const query = `
            SELECT
                sr.id,
                sr.data_emissao,
                sr.chave_mdfe,
                sr.numero_termo,
                sr.chave_nfe,
                sr.numero_cte,
                sr.numero_nfe,
                sr.numero_voo,
                sr.data_registro,
                sr.awb,
                fr.chave_cte AS fr_chave_cte,
                fr.origem AS fr_origem,
                fr.destino AS fr_destino,
                fr.tomador AS fr_tomador,
                fr.notas AS fr_notas,
                fr.data_emissao AS fr_data_emissao,
                fr.destinatario AS fr_destinatario,
                sst.situacao AS sefaz_status_situacao -- NOVO CAMPO AQUI
            FROM sefaz_report sr
            LEFT JOIN franchise_report fr
                ON sr.awb = fr.awb
            LEFT JOIN sefaz_status_termos sst -- NOVO JOIN AQUI
                ON sr.numero_termo = sst.numero_termo
            ${whereString}
            ${havingString}
            ORDER BY sr.data_emissao DESC, sr.numero_termo ASC;
        `;

                const finalParams = params.concat(finalHavingParams);

                if (LOG_DEBUG) debugLog('[DEBUG-SERVER] Query Combined Data (Simplificada com Status):', query);
                if (LOG_DEBUG) debugLog('[DEBUG-SERVER] Query Params Combined Data (Simplificada com Status):', finalParams);

                const [rows] = await connection.execute(query, finalParams);
                res.status(200).json(rows);
            } catch (error) {
                debugError(`[ERROR-SERVER] Erro durante a consulta de dados combinados: ${error.message}`);
                res.status(500).json({ success: false, message: 'Erro durante a consulta.' });
            } finally {
                if (connection) {
                    connection.release();
                }
            }
        });


        app.get('/api/awbs-by-destination', async (req, res) => {
            let connection;
            try {
                // Obtém a instância do pool de conexões
                const currentPool = await getDbPoolInstance();
                connection = await currentPool.getConnection(); // <-- Correção aqui
                const query = `
                    SELECT destino, COUNT(awb) AS total_awbs
                    FROM franchise_report
                    WHERE destino IS NOT NULL AND destino != ''
                    GROUP BY destino
                    ORDER BY destino ASC;
                `;
                const [rows] = await connection.execute(query);
                res.status(200).json(rows);
            } catch (error) {
                debugError(`[ERROR-SERVER] Erro ao buscar AWBs por destino: ${error.message}`);
                res.status(500).json({ success: false, message: 'Erro ao buscar AWBs por destino.' });
            } finally {
                if (connection) connection.release();
            }
        });

        app.get('/api/missing-dates', async (req, res) => {
            let connection;
            try {
                // Obtém a instância do pool de conexões
                const currentPool = await getDbPoolInstance();
                connection = await currentPool.getConnection(); // <-- Correção aqui
                const missingDatesByDestination = {};
                const today = new Date();
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(today.getDate() - 29);

                const [allDestinationsRows] = await connection.execute('SELECT DISTINCT destino FROM franchise_report WHERE destino IS NOT NULL AND destino != "" ORDER BY destino ASC;');
                const allDestinations = allDestinationsRows.map(row => row.destino);

                for (const destino of allDestinations) {
                    missingDatesByDestination[destino] = [];
                    const [presentDatesRows] = await connection.execute('SELECT DISTINCT data_emissao FROM franchise_report WHERE destino = ? AND data_emissao IS NOT NULL AND data_emissao != "";', [destino]);
                    const presentDatesRaw = presentDatesRows.map(row => row.data_emissao);

                    const presentDatesFormatted = new Set(
                        presentDatesRaw.map(dateStr => {
                            if (!dateStr || dateStr.length !== 10 || dateStr.indexOf('/') === -1) {
                                return null;
                            }
                            const [d, m, y] = dateStr.split('/');
                            return `${y}${m}${d}`;
                        }).filter(Boolean)
                    );

                    for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
                        const formattedDate = formatDateToDDMMYYYY(d);
                        const formattedDateForComparison = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

                        if (!presentDatesFormatted.has(formattedDateForComparison)) {
                            missingDatesByDestination[destino].push(formattedDate);
                        }
                    }
                }
                res.status(200).json(missingDatesByDestination);
            } catch (error) {
                debugError(`[ERROR-SERVER] Erro ao buscar datas faltantes: ${error.message}`);
                res.status(500).json({ success: false, message: 'Erro ao buscar datas faltantes.' });
            } finally {
                if (connection) connection.release();
            }
        });

        function validateXlsx(req, res, next) {
            const file = req.file;
            if (!file || file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                debugWarn('Formato de arquivo XLSX inválido recebido.');
                return res.status(400).json({ success: false, message: 'Formato de arquivo inválido. Por favor, envie um arquivo XLSX.' });
            }
            next();
        }
        // --- ROTA PARA RECEBER LOGS DO FRONTEND ---
        app.post('/api/log', async (req, res) => {
            const { action, user_ip, mac_address, user_agent, details, success } = req.body;
            try {
                await insertLog({ action, user_ip, mac_address, user_agent, details, success });
                res.status(200).json({ success: true, message: 'Log registrado com sucesso.' });
            } catch (error) {
                debugError(`[ERROR-SERVER] Erro ao processar requisição de log: ${error.message}`);
                res.status(500).json({ success: false, message: 'Erro ao registrar log.' });
            }
        });

        // --- NOVA ROTA PARA BUSCAR ÚLTIMA DATA DE IMPORTAÇÃO DE FRANCHISE ---
        app.get('/api/last-franchise-import-date', async (req, res) => {
            try {
                const lastDate = await getLastFranchiseImportDate();
                if (lastDate) {
                    const formattedDate = new Date(lastDate).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                        hour12: false
                    });
                    res.status(200).json({ last_update: formattedDate });
                } else {
                    res.status(200).json({ last_update: 'N/A' });
                }
            } catch (error) {
                debugError(`[ERROR-SERVER] Erro ao buscar última data de importação de franchise: ${error.message}`);
                res.status(500).json({ success: false, message: 'Erro ao buscar data de atualização.' });
            }
        });

        // --- ROTA PARA UPLOAD E PROCESSAMENTO DE STATUS DE TERMOS ---
        app.post('/api/upload-status-termos', async (req, res) => {
            const { pasted_data } = req.body;

            if (!pasted_data || typeof pasted_data !== 'string') {
                await insertLog({ action: 'Falha na Importação de Status (Dados Inválidos)', details: { data: pasted_data }, success: false });
                return res.status(400).json({ success: false, message: 'Dados colados inválidos ou ausentes.' });
            }

            await insertLog({ action: 'Início da Importação de Status de Termos', details: { dataLength: pasted_data.length }, success: true });

            try {
                const lines = pasted_data.trim().split(/\r?\n/);
                if (lines.length <= 1) {
                    await insertLog({ action: 'Falha na Importação de Status (Sem Dados Válidos)', details: { data: pasted_data }, success: false });
                    return res.status(400).json({ success: false, message: 'Nenhum dado válido para processar.' });
                }

                if (LOG_DEBUG) debugLog('Pasted data raw:', pasted_data);
                if (LOG_DEBUG) debugLog('Parsed lines:', lines);

                const dataRows = lines.slice(1); // Ignorar linha de cabeçalho

                const parsedData = [];
                for (const rowText of dataRows) {
                    const rowPattern = /^(\S+)\s+(\S+)\s+(.+?)\s+(R\$?\s*[0-9.,]+)/;
                    const match = rowText.match(rowPattern);

                    if (!match) {
                        debugWarn(`[WARN] Linha não corresponde ao padrão esperado, ignorando: "${rowText}"`);
                        await insertLog({ action: 'Falha na Importação de Status (Linha Inválida)', details: { line: rowText }, success: false });
                        continue;
                    }

                    if (LOG_DEBUG) debugLog(`Processing row: "${rowText}"`);
                    if (LOG_DEBUG) debugLog('Row matches (regex extraction):', match);

                    const numero_termo = match[1].trim();
                    const data_status = match[2].trim();
                    const situacao_bruta = match[3].trim();
                    const valor_bruto = match[4].trim();

                    const valor_final_para_db = valor_bruto
                        ? parseFloat(valor_bruto.replace(/[^\d,.]/g, '').replace(',', '.'))
                        : null;

                    const situacao_limpa = situacao_bruta.replace(/R\$?\s*[0-9.,]+/, '').trim();


                    if (LOG_DEBUG) debugLog(`Extracted numero_termo: "${numero_termo}"`);
                    if (LOG_DEBUG) debugLog(`Extracted data_status: "${data_status}"`);
                    if (LOG_DEBUG) debugLog(`Extracted situacao_limpa: "${situacao_limpa}"`);
                    if (LOG_DEBUG) debugLog(`Extracted valor_bruto: "${valor_bruto}"`);
                    if (LOG_DEBUG) debugLog(`Extracted valor_final_para_db: ${valor_final_para_db}`);

                    parsedData.push([numero_termo, data_status, situacao_limpa, valor_final_para_db]);
                }

                if (parsedData.length === 0) {
                    await insertLog({ action: 'Falha na Importação de Status (Nenhum Dado Parseado)', details: { pastedData: pasted_data }, success: false });
                    return res.status(400).json({ success: false, message: 'Nenhum dado válido pôde ser extraído dos dados colados.' });
                }

                if (LOG_DEBUG) debugLog('Parsed data before DB insertion:', parsedData);

                const result = await insertOrUpdateSefazStatusTermos(parsedData);

                await insertLog({
                    action: 'Importação de Status de Termos Concluída', details: {
                        registrosProcessados: result.totalProcessed,
                        inseridos: result.insertedCount,
                        atualizados: result.updatedCount
                    }, success: true
                });

                res.status(200).json({
                    success: true,
                    message: `Status de termos importados: ${result.insertedCount} inseridos, ${result.updatedCount} atualizados.`,
                    insertedCount: result.insertedCount,
                    updatedCount: result.updatedCount,
                    totalProcessed: result.totalProcessed
                });

            } catch (error) {
                debugError(`[ERROR-SERVER] Erro ao processar dados de status de termos: ${error.message}`);
                await insertLog({ action: 'Falha na Importação de Status de Termos', details: { error: error.message, data: pasted_data }, success: false });
                res.status(500).json({ success: false, message: 'Erro ao processar os dados de status de termos.' });
            }
        });


        app.listen(port, '0.0.0.0', () => {
            if (LOG_DEBUG) debugLog(`Backend rodando em http://0.0.0.0:${port}`);
            if (LOG_DEBUG) debugLog(`Modo de Depuração (LOG_DEBUG_MODE) está ATIVO.`);
        });
    })
    .catch(err => {
        debugError('[SERVER-INIT] Falha crítica ao iniciar o servidor devido a erro no DB:', err);
        process.exit(1);
    });