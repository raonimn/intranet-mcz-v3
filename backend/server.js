// backend/server.js
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const cors = require('cors');

// Importa o pool de conexões e as funções de criação/inserção
const {
    pool, // <-- AGORA IMPORTAMOS O POOL
    createFranchiseReportTable,
    createSefazReportTable,
    insertOrUpdateFranchiseReport,
    insertSefazReportData,
} = require('./database');

// Importa o processador de PDF
const { processPdfAndSaveData } = require('./services/pdfProcessor');


const app = express();
const port = process.env.PORT || 8080;
const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';


// Middleware
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Remover: const dbPath = path.resolve(__dirname, process.env.DATABASE_PATH || './dados.db'); // Não mais usado para MySQL

// Função auxiliar para formatar a data como DD/MM/YYYY
const formatDateToDDMMYYYY = (date) => {
    if (!date) return '';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
};

// --- CRIAÇÃO DE TABELAS NA INICIALIZAÇÃO DO SERVIDOR ---
const initializeDatabase = async () => {
    try {
        if (LOG_DEBUG) console.log('[SERVER-INIT] Inicializando banco de dados MySQL...');
        await createFranchiseReportTable();
        await createSefazReportTable();
        if (LOG_DEBUG) console.log('[SERVER-INIT] Banco de dados MySQL inicializado com sucesso.');
    } catch (error) {
        console.error('[SERVER-INIT] Falha crítica ao inicializar o banco de dados MySQL:', error.message);
        process.exit(1);
    }
};

initializeDatabase().then(() => {
    // Remover rotas HTML antigas (se ainda existirem)
    app.get('/', (req, res) => res.send('Backend rodando! O frontend React deve ser acessado separadamente.'));

    // --- Rotas de API ---

    // API para upload de arquivos PDF e processamento
    app.post('/api/upload-pdf', upload.single('pdf_file'), async (req, res) => {
        const file = req.file;
        const numeroVoo = req.body.numeroVoo;
        const dataRegistro = req.body.dataRegistro;

        if (!file) return res.status(400).json({ success: false, message: 'Nenhum arquivo PDF enviado.' });
        if (!numeroVoo || !numeroVoo.trim()) return res.status(400).json({ success: false, message: 'Por favor, insira o número do voo.' });
        if (!dataRegistro || !dataRegistro.trim()) return res.status(400).json({ success: false, message: 'Por favor, insira a data de registro.' });

        if (LOG_DEBUG) {
            console.log(`[DEBUG-SERVER] PDF recebido: ${file.originalname}, Número do Voo: ${numeroVoo}, Data de Registro: ${dataRegistro}`);
        }

        try {
            const result = await processPdfAndSaveData(file.buffer, numeroVoo, dataRegistro);

            const formatNumber = (num) => new Intl.NumberFormat('pt-BR').format(num);

            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: `Voo ${numeroVoo} do dia ${dataRegistro} processado com sucesso.`,
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

    // API para upload de arquivos XLSX
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

            await insertOrUpdateFranchiseReport(processedData);

            // Consulta o total de AWBs agora usando o pool MySQL
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

    // API para consultar os dados combinados (tabela principal)
    app.get('/api/combined-data-specific', async (req, res) => {
        const { numeroVoo, dataRegistro, awb, numeroTermo, destino } = req.query;
        let connection; // Usar 'connection' em vez de 'conn' para clareza com pool
        try {
            connection = await pool.getConnection(); // Obtém uma conexão do pool

            let whereClauses = [];
            let params = [];

            // Filtro para Voo
            if (numeroVoo && numeroVoo.trim() !== '') {
                let formattedVoo = numeroVoo.trim();
                if (formattedVoo.length === 4) {
                    formattedVoo = `AD${formattedVoo}`;
                }
                whereClauses.push('sr.numero_voo LIKE ?');
                params.push(`%${formattedVoo}%`);
            }

            // Filtro para Data do Registro (Termo)
            if (dataRegistro && dataRegistro.trim() !== '') {
                // No MySQL, você pode comparar strings de data diretamente se o formato for YYYY-MM-DD
                // Se for DD/MM/YYYY, precisa de STR_TO_DATE
                // Assumindo que `data_registro` no DB será DD/MM/YYYY, faremos a comparação de string
                whereClauses.push('sr.data_registro = ?');
                params.push(dataRegistro.trim());
            } else {
                const today = new Date();
                const twoDaysAgo = new Date();
                twoDaysAgo.setDate(today.getDate() - 2);

                const formatDateForQuery = (date) => {
                    const d = String(date.getDate()).padStart(2, '0');
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const y = date.getFullYear();
                    // Para MySQL, é ideal que as datas no DB sejam YYYY-MM-DD para BETWEEN funcionar bem.
                    // Se estiver DD/MM/YYYY, comparar como string pode funcionar, mas não é ideal para ranges.
                    // Para consistência, manteremos o formato DD/MM/YYYY na query.
                    return `${d}/${m}/${y}`;
                };

                const todayFormattedForQuery = formatDateForQuery(today);
                const twoDaysAgoFormattedForQuery = formatDateForQuery(twoDaysAgo);

                // Para comparar datas em formato DD/MM/YYYY no MySQL como um range:
                // Converte para um formato comparável (YYYYMMDD) usando STR_TO_DATE
                whereClauses.push("STR_TO_DATE(sr.data_registro, '%d/%m/%Y') BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')");
                params.push(twoDaysAgoFormattedForQuery);
                params.push(todayFormattedForQuery);
            }

            // NOVO FILTRO: AWB
            if (awb && awb.trim() !== '') {
                let formattedAwb = awb.trim();
                if (!formattedAwb.startsWith('577')) {
                    formattedAwb = `577${formattedAwb}`;
                }
                whereClauses.push('fr.awb LIKE ?');
                params.push(`%${formattedAwb}%`);
            }

            // NOVO FILTRO: Número do Termo
            if (numeroTermo && numeroTermo.trim() !== '') {
                whereClauses.push('sr.numero_termo = ?');
                params.push(numeroTermo.trim());
            }

            // NOVO FILTRO: Destino (exato, transformado para maiúsculas no frontend)
            if (destino && destino.trim() !== '') {
                whereClauses.push('fr.destino = ?');
                params.push(destino.toUpperCase().trim()); // <-- Já é UPPER no frontend antes de enviar
            }

            const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            const query = `
                SELECT
                    sr.numero_termo,
                    sr.numero_voo,
                    sr.data_registro,
                    sr.data_emissao AS sefaz_data_emissao,
                    sr.chave_mdfe,
                    sr.chave_nfe,
                    sr.numero_cte,
                    sr.numero_nfe,
                    fr.awb,
                    fr.chave_cte AS fr_chave_cte,
                    fr.origem,
                    fr.destino,
                    fr.tomador,
                    fr.destinatario,
                    fr.notas,
                    fr.data_emissao AS franchise_data_emissao
                FROM sefaz_report AS sr
                LEFT JOIN franchise_report AS fr
                ON SUBSTR(fr.chave_cte, 26, 9) = LPAD(sr.numero_cte, 9, '0') -- LPAD para zero-padding
                ${whereString}
                ORDER BY sr.data_registro DESC, sr.numero_termo ASC;
            `;

            if (LOG_DEBUG) {
                console.log('[DEBUG-SERVER] Query Combined Data:', query);
                console.log('[DEBUG-SERVER] Query Params Combined Data:', params);
            }

            const [rows] = await connection.execute(query, params); // Usa connection.execute() para queries com placeholders
            res.status(200).json(rows);
        } catch (error) {
            console.error(`[ERROR-SERVER] Erro durante a consulta de dados combinados: ${error.message}`);
            res.status(500).json({ success: false, message: 'Erro durante a consulta.' });
        } finally {
            if (connection) {
                connection.release(); // Libera a conexão
            }
        }
    });

    // --- Rota: Contagem de AWBs por Destino ---
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

    // --- Rota: Datas Faltantes por Destino ---
    app.get('/api/missing-dates', async (req, res) => {
        let connection;
        try {
            connection = await pool.getConnection();
            const missingDatesByDestination = {};
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 29); // 30 dias incluindo hoje

            const [allDestinationsRows] = await connection.execute('SELECT DISTINCT destino FROM franchise_report WHERE destino IS NOT NULL AND destino != "" ORDER BY destino ASC;');
            const allDestinations = allDestinationsRows.map(row => row.destino);

            for (const destino of allDestinations) {
                missingDatesByDestination[destino] = [];
                const [presentDatesRows] = await connection.execute('SELECT DISTINCT data_emissao FROM franchise_report WHERE destino = ? AND data_emissao IS NOT NULL AND data_emissao != "";', [destino]);
                const presentDatesRaw = presentDatesRows.map(row => row.data_emissao);

                const presentDatesFormatted = new Set(
                    presentDatesRaw.map(dateStr => {
                        if (!dateStr || dateStr.length !== 10 || dateStr.indexOf('/') === -1) {
                            return null; // Ignora datas inválidas
                        }
                        const [d, m, y] = dateStr.split('/');
                        return `${y}${m}${d}`;
                    }).filter(Boolean) // Remove nulos
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

    app.listen(port, '0.0.0.0', () => {
        console.log(`Backend rodando em http://0.0.0.0:${port}`);
        if (LOG_DEBUG) {
            console.log(`Modo de Depuração (LOG_DEBUG_MODE) está ATIVO.`);
        }
    });
}).catch(err => {
    console.error('[SERVER-INIT] Falha crítica ao iniciar o servidor devido a erro no DB:', err);
    process.exit(1);
});