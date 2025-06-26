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
app.use(cors());
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
            return res.status(400).send('Nenhum arquivo enviado.');
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
            // Banco: awb, chave_cte, data_emissao, origem, destino, tomador, notas, destinatario
            // Planilha: B, D, F, I, J, T, BC, N
            // Indices (0-indexed):
            // AWB: B (1) -> dado[0]
            // chave_cte: D (3) -> dado[1]
            // data_emissao: F (5) -> dado[2]
            // origem: I (8) -> dado[3]
            // destino: J (9) -> dado[4]
            // tomador: T (19) -> dado[5]
            // notas: BC (54) -> dado[6]
            // destinatario: N (13) -> dado[7]

            const columnsToExtractIndices = [1, 3, 5, 8, 9, 19, 54, 13];

            const processedData = jsonData.slice(1).map((row) => { // Pula a primeira linha (cabeçalho)
                const mappedRow = columnsToExtractIndices.map((colIndex) => {
                    if (colIndex === 5 && typeof row[colIndex] === 'number') { // Coluna F para data_emissao
                        const excelSerialDate = row[colIndex];
                        const date = new Date((excelSerialDate - 25569) * 24 * 60 * 60 * 1000);
                        return formatDateToDDMMYYYY(date);
                    }
                    return row[colIndex] || '';
                });
                return mappedRow;
            }).filter(row => row.some(cell => cell !== ''));

            if (LOG_DEBUG) {
                console.log('[DEBUG-SERVER] Selected data for DB insertion (first 5 processed rows):', processedData.slice(0, 5));
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
            console.error('[ERROR-SERVER] Erro ao processar arquivo XLSX:', error.message);
            res.status(500).json({
                success: false,
                message: 'Erro ao processar arquivo: ' + error.message
            });
        }
    });

    // API para consultar os dados combinados
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
                    return `${y}${m}${d}`; // Formato YYYYMMDD para comparação numérica
                };

                const todayFormattedForQuery = formatDateForQuery(today);
                const twoDaysAgoFormattedForQuery = formatDateForQuery(twoDaysAgo);

                whereClauses.push('CAST(SUBSTR(sr.data_registro, 7, 4) || SUBSTR(sr.data_registro, 4, 2) || SUBSTR(sr.data_registro, 1, 2) AS INTEGER) BETWEEN ? AND ?');
                params.push(parseInt(twoDaysAgoFormattedForQuery, 10));
                params.push(parseInt(todayFormattedForQuery, 10));
            }

            const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            // Corrigido para LEFT JOIN e seleção de campos explícita
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

    function validateXlsx(req, res, next) {
        const file = req.file;
        if (!file || file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            return res.status(400).json({ success: false, message: 'Formato de arquivo inválido. Por favor, envie um arquivo XLSX.' });
        }
        next();
    }

    app.listen(port, () => {
        console.log(`Backend rodando em http://localhost:${port}`);
        if (LOG_DEBUG) {
            console.log(`Modo de Depuração (LOG_DEBUG_MODE) está ATIVO.`);
        }
    });
}).catch(err => {
    console.error('[SERVER-INIT] Falha crítica ao iniciar o servidor devido a erro no DB:', err);
    process.exit(1);
});