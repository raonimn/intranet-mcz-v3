// backend/server.js

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

// Importa todas as funções do banco de dados (agora centralizadas)
const {
    createFranchiseReportTable,
    createSefazReportTable,
    // createTermosInseridosTable,
    insertOrUpdateFranchiseReport,
    insertSefazReportData,
    createConnection
} = require('./database');

// Importa o processador de PDF
const { processPdfAndSaveData } = require('./services/pdfProcessor');


const app = express();
const port = process.env.PORT || 8080;
const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';


// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições sem origem (ex: Postman, curl, arquivos locais)
        if (!origin) return callback(null, true);

        // Defina aqui o(s) padrão(ões) do(s) IP(s) da sua rede local.
        // Substitua '192.168.1.' pelo seu padrão de IP real.
        // O (:\d+)? permite que a URL inclua uma porta (ex: :5173)
        const allowedIpPatterns = [
            /^http:\/\/192\.168\.0\.\d{1,3}(:\d+)?$/, // Exemplo: http://192.168.1.X:5173
            /^http:\/\/10\.0\.0\.\d{1,3}(:\d+)?$/,   // Exemplo: http://10.0.0.X:5173
            /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/, // Exemplo: 172.16.0.0 a 172.31.255.255
            // Inclua o localhost e 127.0.0.1 para testes locais na máquina do backend
            /^http:\/\/localhost(:\d+)?$/,
            /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        ];

        const isAllowed = allowedIpPatterns.some(pattern => {
            // Adiciona um log para depuração do CORS
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
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos HTTP permitidos
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // Adicionado X-Requested-With
    credentials: true // Importante se você planeja usar cookies ou cabeçalhos de autorização
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Caminho para o arquivo do banco de dados SQLite
const dbPath = path.resolve(__dirname, process.env.DATABASE_PATH || './dados.db');

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
        if (LOG_DEBUG) console.log('[SERVER-INIT] Inicializando banco de dados...');
        await createFranchiseReportTable();
        await createSefazReportTable();
        //       await createTermosInseridosTable();
        if (LOG_DEBUG) console.log('[SERVER-INIT] Banco de dados inicializado com sucesso.');
    } catch (error) {
        console.error('[SERVER-INIT] Falha crítica ao inicializar o banco de dados:', error.message);
        process.exit(1);
    }
};

initializeDatabase().then(() => {
    app.use(express.static('public'));
    app.use('/files', express.static(path.join(__dirname, 'public', 'files')));

    app.get('/', (req, res) => res.send('Frontend React será servido aqui!'));
    app.get('/impreport', (req, res) => res.sendFile(path.join(__dirname, 'public', 'importarreport.html')));
    app.get('/imptermo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'importatermo.html')));
    app.get('/natura', (req, res) => res.sendFile(path.join(__dirname, 'public', 'natura.html')));

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
            // A função processPdfAndSaveData agora retorna um objeto com insertedCount, duplicateCount, etc.
            const result = await processPdfAndSaveData(file.buffer, numeroVoo, dataRegistro);

            const formatNumber = (num) => new Intl.NumberFormat('pt-BR').format(num);

            if (result.success) { // Verifica se processPdfAndSaveData indica sucesso
                res.status(200).json({
                    success: true,
                    message: `Voo ${numeroVoo} do dia ${dataRegistro} processado com sucesso.`,
                    recordsProcessed: result.insertedCount, // Quantidade de termos NOVOS inseridos
                    additionalInfo: `Inseridos ${formatNumber(result.insertedCount)} notas. (${formatNumber(result.duplicateCount)} duplicidades ignoradas).`
                    // A contagem de "termos" únicos pode ser mais complexa se não usarmos termos_inseridos.
                    // Por enquanto, focaremos nas "notas" (linhas) que foram inseridas ou ignoradas.
                });
            } else {
                // Se processPdfAndSaveData retornar { success: false, message: '...' }
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

            // Mapeamento Planilha para Banco:
            // Banco: AWB (PK), chave_cte, data_emissao, origem, destino, tomador, notas, destinatario
            // Planilha: B, D, F, I, J, T, BC, N
            // Indices (0-indexed):
            // AWB: B (1)
            // chave_cte: D (3)
            // data_emissao: F (5)
            // origem: I (8)
            // destino: J (9)
            // tomador: T (19)
            // notas: BC (54)
            // destinatario: N (13)

            const columnsToExtractIndices = [1, 3, 5, 8, 9, 19, 54, 13];

            const processedData = jsonData.slice(1).map((row) => { // Pula a primeira linha (cabeçalho)
                const mappedRow = columnsToExtractIndices.map((colIndex) => {
                    if (colIndex === 5 && typeof row[colIndex] === 'number') { // Coluna F para data_emissao
                        const excelSerialDate = row[colIndex];
                        const date = new Date((excelSerialDate - 25569) * 24 * 60 * 60 * 1000);
                        return formatDateToDDMMYYYY(date); // Use a função auxiliar já definida
                    }
                    return row[colIndex] || '';
                });
                return mappedRow;
            }).filter(row => row.some(cell => cell !== '')); // Filtra linhas completamente vazias

            if (LOG_DEBUG) {
                console.log('[DEBUG-SERVER] Selected data for DB insertion (first 5 processed rows):', processedData.slice(0, 5));
            }

            // Vamos adicionar um log para o total de linhas a serem inseridas/atualizadas
            if (LOG_DEBUG) {
                console.log(`[DEBUG-SERVER] Total de linhas processadas do XLSX para inserção: ${processedData.length}`);
            }


            await insertOrUpdateFranchiseReport(processedData);

            const conn = createConnection();
            const count = await new Promise((resolve, reject) => {
                conn.get('SELECT COUNT(*) AS total FROM franchise_report', (err, row) => {
                    if (err) reject(err);
                    else resolve(row.total);
                });
            }).finally(() => conn.close());

            const formatNumber = (num) => new Intl.NumberFormat('pt-BR').format(num);

            res.status(200).json({
                success: true,
                message: `Dados importados com sucesso! ${formatNumber(processedData.length)} registros processados do arquivo.`,
                recordsProcessed: processedData.length,
                additionalInfo: `(${formatNumber(count)} registros no banco)`
            });

        } catch (error) {
            // Log detalhado do erro, incluindo o stack trace
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

    // API para consultar os dados combinados
    // API para consultar os dados combinados (tabela principal)
    app.get('/api/combined-data-specific', async (req, res) => {
        const { numeroVoo, dataRegistro } = req.query;
        const { createConnection } = require('./database');

        let conn;
        try {
            conn = createConnection();

            let whereClauses = [];
            let params = [];

            if (numeroVoo && numeroVoo.trim() !== '') {
                whereClauses.push('sr.numero_voo LIKE ?');
                params.push(`%${numeroVoo.trim()}%`);
            }

            if (dataRegistro && dataRegistro.trim() !== '') {
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
                    return `${y}${m}${d}`;
                };

                const todayFormattedForQuery = formatDateForQuery(today);
                const twoDaysAgoFormattedForQuery = formatDateForQuery(twoDaysAgo);

                whereClauses.push('CAST(SUBSTR(sr.data_registro, 7, 4) || SUBSTR(sr.data_registro, 4, 2) || SUBSTR(sr.data_registro, 1, 2) AS INTEGER) BETWEEN ? AND ?');
                params.push(parseInt(twoDaysAgoFormattedForQuery, 10));
                params.push(parseInt(todayFormattedForQuery, 10));
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
                ON PRINTF('%09d', sr.numero_cte) = SUBSTR(fr.chave_cte, 26, 9)
                ${whereString}
                ORDER BY sr.data_registro DESC, sr.numero_termo ASC;
            `;

            if (LOG_DEBUG) {
                console.log('[DEBUG-SERVER] Query Combined Data:', query);
                console.log('[DEBUG-SERVER] Query Params Combined Data:', params);
            }

            const result = await new Promise((resolve, reject) => {
                conn.all(query, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            res.status(200).json(result);
        } catch (error) {
            console.error(`[ERROR-SERVER] Erro durante a consulta de dados combinados: ${error.message}`);
            res.status(500).json({ success: false, message: 'Erro durante a consulta.' });
        } finally {
            if (conn) {
                conn.close((err) => {
                    if (err) console.error("[ERROR-SERVER] Erro ao fechar a conexão de dados combinados:", err.message);
                });
            }
        }
    });

    // --- NOVA ROTA: Contagem de AWBs por Destino ---
    app.get('/api/awbs-by-destination', async (req, res) => {
        const conn = createConnection();
        try {
            const query = `
                SELECT destino, COUNT(awb) AS total_awbs
                FROM franchise_report
                GROUP BY destino
                ORDER BY destino ASC;
            `;
            const result = await new Promise((resolve, reject) => {
                conn.all(query, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            res.status(200).json(result);
        } catch (error) {
            console.error(`[ERROR-SERVER] Erro ao buscar AWBs por destino: ${error.message}`);
            res.status(500).json({ success: false, message: 'Erro ao buscar AWBs por destino.' });
        } finally {
            if (conn) conn.close();
        }
    });

    // --- NOVA ROTA: Datas Faltantes por Destino ---
    app.get('/api/missing-dates', async (req, res) => {
        const conn = createConnection();
        try {
            const missingDatesByDestination = {};
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 29); // 30 dias incluindo hoje

            const allDestinations = await new Promise((resolve, reject) => {
                conn.all('SELECT DISTINCT destino FROM franchise_report ORDER BY destino ASC;', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => row.destino));
                });
            });

            for (const destino of allDestinations) {
                missingDatesByDestination[destino] = [];
                const presentDatesRaw = await new Promise((resolve, reject) => {
                    conn.all('SELECT DISTINCT data_emissao FROM franchise_report WHERE destino = ?;', [destino], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows.map(row => row.data_emissao));
                    });
                });

                // Converter para formato YYYYMMDD para comparação
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
            if (conn) conn.close();
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