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
    pool,
    insertSefazReportData,
    insertFranchiseReportData,
    getSefazReportData,
    getFranchiseReportData,
    insertLog,
    getLastFranchiseImportDate // --- IMPORTAR A FUNÇÃO ---
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

// --- ALTERAÇÃO PRINCIPAL AQUI: Envolver TUDO dentro do .then() de initializeDatabase ---
// Isso garante que o servidor Express só configure suas rotas e comece a escutar
// APÓS o banco de dados ter sido inicializado e o pool estar pronto.
initializeDatabase()
    .then(() => {
        // Log de sucesso após a inicialização do DB
        if (LOG_DEBUG) console.log('[SERVER-INIT] Banco de dados MySQL inicializado com sucesso.');

        // Agora, TODAS as definições de rota e o app.listen() vêm AQUI DENTRO.
        app.get('/', (req, res) => res.send('Backend rodando! O frontend React deve ser acessado separadamente.'));

        app.post('/api/upload-pdf', upload.single('pdf_file'), async (req, res) => {
            const file = req.file;
            const numeroVoo = req.body.numeroVoo;

            if (!file) return res.status(400).json({ success: false, message: 'Nenhum arquivo PDF enviado.' });
            if (!numeroVoo || !numeroVoo.trim()) return res.status(400).json({ success: false, message: 'Por favor, insira o número do voo.' });

            if (LOG_DEBUG) {
                console.log(`[DEBUG-SERVER] PDF recebido: ${file.originalname}, Número do Voo: ${numeroVoo}`);
            }

            try {
                const result = await processPdfAndSaveData(file.buffer, numeroVoo);

                const formatNumber = (num) => new Intl.NumberFormat('pt-BR').format(num);

                if (result.success) {
                    res.status(200).json({
                        success: true,
                        message: `Voo ${numeroVoo} processado com sucesso.`,
                        recordsProcessed: result.insertedCount,
                        additionalInfo: `Inseridos ${formatNumber(result.insertedCount)} notas. (${formatNumber(result.duplicateCount)} duplicidades ignoradas).`,
                        extractedData: result.extractedData
                    });
                } else {
                    res.status(500).json({ success: false, message: result.message || 'Erro ao processar o PDF.' });
                }
            } catch (error) {
                console.error('[ERROR-SERVER] Erro na rota /api/upload-pdf:', error);
                res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
            }
        });

        app.post('/api/upload-report', upload.single('xlsx_file'), validateXlsx, async (req, res) => {
            const file = req.file;

            if (!file) {
                return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
            }

            try {
                const buffer = file.buffer;
                const workbook = xlsx.read(buffer, { type: 'buffer' });

                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0 });

                if (LOG_DEBUG) {
                    console.log('[DEBUG-SERVER] JSON data from XLSX (first 5 rows):', jsonData.slice(0, 5));
                }

                const columnsToExtractIndices = [1, 3, 5, 8, 9, 19, 54, 13];

                const processedData = jsonData.slice(1).map((row) => {
                    const mappedRow = columnsToExtractIndices.map((colIndex) => {
                        if (colIndex === 5 && typeof row[colIndex] === 'number') {
                            const excelSerialDate = row[colIndex];
                            const date = new Date((excelSerialDate - 25569) * 24 * 60 * 60 * 1000);
                            return formatDateToDDMMYYYY(date);
                        }
                        return row[colIndex] || '';
                    });
                    return mappedRow;
                }).filter(row => row.some(cell => cell !== ''));

                if (LOG_DEBUG) {
                    console.log(`[DEBUG-SERVER] Total de linhas processadas do XLSX para inserção: ${processedData.length}`);
                }

                await insertFranchiseReportData(processedData);

                const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM franchise_report');
                const count = rows[0].total;

                const formatNumber = (num) => new Intl.NumberFormat('pt-BR').format(num);

                res.status(200).json({
                    success: true,
                    message: `Dados importados com sucesso! ${formatNumber(processedData.length)} registros processados do arquivo.`,
                    recordsProcessed: processedData.length,
                    additionalInfo: `(${formatNumber(count)} registros no banco)`
                });

            } catch (error) {
                console.error(`[ERROR-SERVER] Erro fatal ao processar arquivo XLSX: ${error.message}`);
                if (error.stack) {
                    console.error('[ERROR-SERVER] Stack trace:', error.stack);
                }
                res.status(500).json({
                    success: false,
                    message: 'Erro ao processar arquivo: ' + (error.message || 'Erro desconhecido.')
                });
            }
        });

        app.get('/api/combined-data-specific', async (req, res) => {
            const { numeroVoo, dataTermo, awb, numeroTermo, destino } = req.query;
            let connection;
            try {
                connection = await pool.getConnection();

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
                    finalHavingClauses.push(`calculated_awb LIKE ?`);
                    finalHavingParams.push(`%${formattedAwb}%`);
                }
                if (destino && destino.trim() !== '') {
                    finalHavingClauses.push(`fr_destino LIKE ?`);
                    finalHavingParams.push(`%${destino.toUpperCase().trim()}%`);
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
                        -- Calcula o AWB final usando COALESCE com a ordem de prioridade CORRETA
                        COALESCE(
                            -- Prioridade 1: sr.numero_cte = SUBSTR(fr1.chave_cte, 26, 9)
                            (SELECT fr1.awb FROM franchise_report fr1 WHERE LPAD(sr.numero_cte, 9, '0') = SUBSTR(fr1.chave_cte, 26, 9) LIMIT 1),
                            -- Prioridade 2: sr.numero_nfe com fr2.notas (tratado)
                            (SELECT fr2.awb FROM franchise_report fr2 WHERE sr.numero_nfe IS NOT NULL AND sr.numero_nfe != '' AND fr2.notas IS NOT NULL AND fr2.notas != '' AND sr.numero_nfe = LTRIM(REPLACE(fr2.notas, '0', ' ')) LIMIT 1),
                            -- Prioridade 3: sr.numero_cte parcial (LIKE %numero_cte%) na chave_cte
                            (SELECT fr_parcial.awb FROM franchise_report fr_parcial WHERE fr_parcial.chave_cte LIKE CONCAT('%', sr.numero_cte, '%') AND LENGTH(sr.numero_cte) > 0 LIMIT 1)
                        ) AS awb,
                        fr_match.chave_cte AS fr_chave_cte,
                        fr_match.origem AS fr_origem,
                        fr_match.destino AS fr_destino,
                        fr_match.tomador AS fr_tomador,
                        fr_match.notas AS fr_notas,
                        fr_match.data_emissao AS fr_data_emissao,
                        fr_match.destinatario AS fr_destinatario
                    FROM sefaz_report sr
                    LEFT JOIN franchise_report fr_match
                        ON fr_match.awb = COALESCE(
                            -- PRIORIDADE 1: Match de CTE completo (igual ao primeiro COALESCE)
                            (SELECT fr_sub1.awb FROM franchise_report fr_sub1 WHERE LPAD(sr.numero_cte, 9, '0') = SUBSTR(fr_sub1.chave_cte, 26, 9) LIMIT 1),
                            -- PRIORIDADE 2: Match de NFe vs Notas (igual ao segundo COALESCE)
                            (SELECT fr_sub2.awb FROM franchise_report fr_sub2 WHERE sr.numero_nfe IS NOT NULL AND sr.numero_nfe != '' AND fr_sub2.notas IS NOT NULL AND fr_sub2.notas != '' AND sr.numero_nfe = LTRIM(REPLACE(fr_sub2.notas, '0', ' ')) LIMIT 1),
                            -- PRIORIDADE 3: Match de CTE parcial (igual ao terceiro COALESCE)
                            (SELECT fr_parcial_sub.awb FROM franchise_report fr_parcial_sub WHERE fr_parcial_sub.chave_cte LIKE CONCAT('%', sr.numero_cte, '%') AND LENGTH(sr.numero_cte) > 0 LIMIT 1)
                        )
                    ${whereString}
                    ${havingString}
                    ORDER BY sr.data_emissao DESC, sr.numero_termo ASC;
                `;

                const finalParams = params.concat(finalHavingParams);

                if (LOG_DEBUG) {
                    console.log('[DEBUG-SERVER] Query Combined Data (Final Priority Logic):', query);
                    console.log('[DEBUG-SERVER] Query Params Combined Data (Final Priority Logic):', finalParams);
                }

                const [rows] = await connection.execute(query, finalParams);
                res.status(200).json(rows);
            } catch (error) {
                console.error(`[ERROR-SERVER] Erro durante a consulta de dados combinados: ${error.message}`);
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
                connection = await pool.getConnection();
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
                console.error(`[ERROR-SERVER] Erro ao buscar AWBs por destino: ${error.message}`);
                res.status(500).json({ success: false, message: 'Erro ao buscar AWBs por destino.' });
            } finally {
                if (connection) connection.release();
            }
        });

        app.get('/api/missing-dates', async (req, res) => {
            let connection;
            try {
                connection = await pool.getConnection();
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
                console.error(`[ERROR-SERVER] Erro ao buscar datas faltantes: ${error.message}`);
                res.status(500).json({ success: false, message: 'Erro ao buscar datas faltantes.' });
            } finally {
                if (connection) connection.release();
            }
        });

        function validateXlsx(req, res, next) {
            const file = req.file;
            if (!file || file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                return res.status(400).json({ success: false, message: 'Formato de arquivo inválido. Por favor, envie um arquivo XLSX.' });
            }
            next();
        }

        app.post('/api/log', async (req, res) => {
            const { action, user_ip, mac_address, user_agent, details, success } = req.body;
            try {
                await insertLog({ action, user_ip, mac_address, user_agent, details, success });
                res.status(200).json({ success: true, message: 'Log registrado com sucesso.' });
            } catch (error) {
                console.error(`[ERROR-SERVER] Erro ao processar requisição de log: ${error.message}`);
                res.status(500).json({ success: false, message: 'Erro ao registrar log.' });
            }
        });


        app.get('/api/last-franchise-import-date', async (req, res) => {
            try {
                const lastDate = await getLastFranchiseImportDate();
                if (lastDate) {
                    // Formatar a data para o frontend (DD/MM/YYYY HH:MM)
                    const formattedDate = new Date(lastDate).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                        hour12: false // Formato 24h
                    });
                    res.status(200).json({ last_update: formattedDate });
                } else {
                    res.status(200).json({ last_update: 'N/A' });
                }
            } catch (error) {
                console.error(`[ERROR-SERVER] Erro ao buscar última data de importação de franchise: ${error.message}`);
                res.status(500).json({ success: false, message: 'Erro ao buscar data de atualização.' });
            }
        });


        app.listen(port, '0.0.0.0', () => {
            console.log(`Backend rodando em http://0.0.0.0:${port}`);
            if (LOG_DEBUG) {
                console.log(`Modo de Depuração (LOG_DEBUG_MODE) está ATIVO.`);
            }
        });
    })
    .catch(err => {
        console.error('[SERVER-INIT] Falha crítica ao iniciar o servidor devido a erro no DB:', err);
        process.exit(1);
    });